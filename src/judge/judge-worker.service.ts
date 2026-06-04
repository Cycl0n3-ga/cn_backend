import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
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
  private worker?: Worker<JudgeJobData>;

  constructor(
    private readonly processor: JudgeJobProcessor,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
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
  }
}
