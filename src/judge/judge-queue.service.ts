import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, QueueEvents } from 'bullmq';
import type IORedis from 'ioredis';
import { getPositiveIntEnv, getQueueDriver } from '../config/env.js';
import { JudgeJobProcessor } from './judge-job.processor.js';
import {
  EnqueuedJudgeJob,
  JudgeJobData,
  JudgeQueueStats,
  JUDGE_QUEUE_NAME,
} from './judge-jobs.js';
import { JudgeInput, JudgeResult } from './judge.service.js';
import {
  createRedisConnection,
  createRedisConnectionOptions,
} from './redis-connection.js';

@Injectable()
export class JudgeQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(JudgeQueueService.name);
  private readonly driver = getQueueDriver();
  private readonly concurrency = getPositiveIntEnv('JUDGE_CONCURRENCY', 2);
  private readonly attempts = getPositiveIntEnv('JUDGE_JOB_ATTEMPTS', 3);
  private readonly sampleTimeoutMs = getPositiveIntEnv(
    'JUDGE_SAMPLE_RESULT_TIMEOUT_MS',
    15000,
  );
  private readonly connection?: IORedis;
  private readonly queue?: Queue<JudgeJobData>;
  private readonly queueEvents?: QueueEvents;
  private inlineActive = 0;

  constructor(private readonly processor: JudgeJobProcessor) {
    if (this.driver === 'redis') {
      this.connection = createRedisConnection();
      this.queue = new Queue<JudgeJobData>(JUDGE_QUEUE_NAME, {
        connection: createRedisConnectionOptions(),
        defaultJobOptions: {
          attempts: this.attempts,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 60 * 60, count: 1000 },
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
        },
      });
      this.queueEvents = new QueueEvents(JUDGE_QUEUE_NAME, {
        connection: createRedisConnectionOptions(),
      });
    }
  }

  async enqueueSubmission(submissionId: string): Promise<EnqueuedJudgeJob> {
    if (this.driver === 'inline') {
      const jobId = `inline:${submissionId}`;
      this.inlineActive += 1;
      setImmediate(() => {
        void this.processor
          .processSubmission(submissionId, { jobId, attempt: 1 })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : 'Unknown judge error.';
            this.logger.error(
              JSON.stringify({
                event: 'inline_judge_job_failed',
                submissionId,
                jobId,
                message,
              }),
            );
          })
          .finally(() => {
            this.inlineActive -= 1;
          });
      });
      return { jobId, driver: this.driver };
    }

    const job = await this.getQueue().add(
      'submission',
      { kind: 'submission', submissionId },
      {
        jobId: submissionId,
      },
    );
    return { jobId: String(job.id), driver: this.driver };
  }

  async runSample(input: JudgeInput): Promise<JudgeResult> {
    if (this.driver === 'inline') {
      return this.processor.runSample(input);
    }

    const job = await this.getQueue().add('sample', { kind: 'sample', input });
    return this.waitForSampleResult(job);
  }

  async getStats(): Promise<JudgeQueueStats> {
    if (this.driver === 'inline') {
      return {
        driver: this.driver,
        active: this.inlineActive,
        waiting: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
        concurrency: this.concurrency,
      };
    }

    const counts = await this.getQueue().getJobCounts(
      'active',
      'waiting',
      'delayed',
      'failed',
      'completed',
    );

    return {
      driver: this.driver,
      active: counts.active ?? 0,
      waiting: counts.waiting ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      concurrency: this.concurrency,
    };
  }

  async isReady() {
    if (this.driver === 'inline') {
      return true;
    }

    try {
      await this.connection?.ping();
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queueEvents?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  private async waitForSampleResult(
    job: Job<JudgeJobData>,
  ): Promise<JudgeResult> {
    const result: unknown = await job.waitUntilFinished(
      this.getQueueEvents(),
      this.sampleTimeoutMs,
    );
    return result as JudgeResult;
  }

  private getQueue() {
    if (!this.queue) {
      throw new Error('Redis judge queue is not configured.');
    }
    return this.queue;
  }

  private getQueueEvents() {
    if (!this.queueEvents) {
      throw new Error('Redis judge queue events are not configured.');
    }
    return this.queueEvents;
  }
}
