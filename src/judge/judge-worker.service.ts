import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { Worker } from 'bullmq';
import { getPositiveIntEnv, getQueueDriver } from '../config/env.js';
import { JudgeJobProcessor } from './judge-job.processor.js';
import { JudgeJobData, JUDGE_QUEUE_NAME } from './judge-jobs.js';
import { createRedisConnectionOptions } from './redis-connection.js';
import { MetricsService } from '../observability/metrics.service.js';

@Injectable()
export class JudgeWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JudgeWorkerService.name);
  private readonly driver = getQueueDriver();
  private readonly concurrency = getPositiveIntEnv('JUDGE_CONCURRENCY', 2);
  private readonly metricsPort = getPositiveIntEnv('WORKER_METRICS_PORT', 4101);
  private worker?: Worker<JudgeJobData>;
  private metricsServer?: Server;

  constructor(
    private readonly processor: JudgeJobProcessor,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
    this.startMetricsServer();

    if (this.driver !== 'redis') {
      this.logger.warn(
        'JudgeWorkerService is idle because JUDGE_QUEUE_DRIVER is not redis.',
      );
      return;
    }

    this.worker = new Worker<JudgeJobData>(
      JUDGE_QUEUE_NAME,
      async (job) => {
        const jobId = String(job.id);
        const name = job.name;
        const startedAt = Date.now();
        this.metrics.recordJudgeJobStarted(name);
        this.logger.log(
          JSON.stringify({
            event: 'judge_job_started',
            jobId,
            name,
            attempt: job.attemptsMade + 1,
          }),
        );

        try {
          if (job.data.kind === 'submission') {
            await this.processor.processSubmission(job.data.submissionId, {
              jobId,
              attempt: job.attemptsMade + 1,
            });
            this.metrics.recordJudgeJobCompleted(name, Date.now() - startedAt);
            return { ok: true };
          }

          const result = await this.processor.runSample(job.data.input);
          this.metrics.recordJudgeJobCompleted(name, Date.now() - startedAt);
          return result;
        } catch (error) {
          this.metrics.recordJudgeJobFailed(name, Date.now() - startedAt);
          throw error;
        }
      },
      {
        connection: createRedisConnectionOptions(),
        concurrency: this.concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(
        JSON.stringify({
          event: 'judge_job_completed',
          jobId: String(job.id),
          name: job.name,
        }),
      );
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        JSON.stringify({
          event: 'judge_job_failed',
          jobId: job ? String(job.id) : 'unknown',
          name: job?.name ?? 'unknown',
          message: error.message,
        }),
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await new Promise<void>((resolve, reject) => {
      if (!this.metricsServer) {
        resolve();
        return;
      }

      this.metricsServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private startMetricsServer() {
    this.metricsServer = createServer((request, response) => {
      void this.handleMetricsRequest(request, response);
    });

    this.metricsServer.listen(this.metricsPort, () => {
      this.logger.log(`Judge worker metrics listening on :${this.metricsPort}`);
    });
  }

  private async handleMetricsRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.url === '/health/live') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'UP' }));
      return;
    }

    if (request.url === '/metrics') {
      response.writeHead(200, { 'content-type': this.metrics.contentType });
      response.end(await this.metrics.metrics());
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ statusCode: 404, message: 'Not Found' }));
  }
}
