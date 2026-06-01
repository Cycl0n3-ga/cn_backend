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

@Injectable()
export class JudgeWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JudgeWorkerService.name);
  private readonly driver = getQueueDriver();
  private readonly concurrency = getPositiveIntEnv('JUDGE_CONCURRENCY', 2);
  private worker?: Worker<JudgeJobData>;

  constructor(private readonly processor: JudgeJobProcessor) {}

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
        this.logger.log(
          JSON.stringify({
            event: 'judge_job_started',
            jobId,
            name: job.name,
            attempt: job.attemptsMade + 1,
          }),
        );

        if (job.data.kind === 'submission') {
          await this.processor.processSubmission(job.data.submissionId, {
            jobId,
            attempt: job.attemptsMade + 1,
          });
          return { ok: true };
        }

        return this.processor.runSample(job.data.input);
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
