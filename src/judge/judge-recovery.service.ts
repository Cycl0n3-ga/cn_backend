import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getPositiveIntEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmissionStatus } from '../submissions/submission-status.js';
import { JudgeQueueService } from './judge-queue.service.js';

@Injectable()
export class JudgeRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(JudgeRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  async onModuleInit() {
    if (process.env.JUDGE_RECOVERY_ON_START === 'false') {
      return;
    }

    const recovered = await this.requeueStuckSubmissions();
    if (recovered > 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'stuck_submissions_requeued',
          recovered,
        }),
      );
    }
  }

  async requeueStuckSubmissions() {
    const staleAfterSeconds = getPositiveIntEnv(
      'JUDGE_STUCK_AFTER_SECONDS',
      300,
    );
    const cutoff = new Date(Date.now() - staleAfterSeconds * 1000);

    const stuckSubmissions = await this.prisma.submission.findMany({
      where: {
        status: {
          in: [SubmissionStatus.PENDING, SubmissionStatus.RUNNING],
        },
        createdAt: { lt: cutoff },
      },
      select: { id: true },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    for (const submission of stuckSubmissions) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.PENDING,
          lastError: 'Requeued after startup recovery.',
          queuedAt: new Date(),
        },
      });
      await this.judgeQueueService.enqueueSubmission(submission.id);
    }

    return stuckSubmissions.length;
  }
}
