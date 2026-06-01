import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeQueueService } from '../judge/judge-queue.service.js';
import { SubmissionStatus } from './submission-status.js';
import { hasAnyUserRole, UserRole } from '../auth/user-role.js';

type SubmissionReader = {
  id: string;
  role: string;
};

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  async create(
    userId: string,
    data: { problemId: number; language: string; sourceCode: string },
  ) {
    const normalizedLanguage = data.language.trim().toLowerCase();
    const problem = await this.prisma.problem.findFirst({
      where: { id: data.problemId, isDeleted: false },
    });
    if (!problem) {
      throw new NotFoundException(`Problem #${data.problemId} not found.`);
    }

    const submission = await this.prisma.submission.create({
      data: {
        userId,
        problemId: data.problemId,
        language: normalizedLanguage,
        sourceCode: data.sourceCode,
        status: SubmissionStatus.PENDING,
        queuedAt: new Date(),
      },
    });

    try {
      const job = await this.judgeQueueService.enqueueSubmission(submission.id);
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: { judgeJobId: job.jobId },
      });

      return {
        submission_id: submission.id,
        judge_job_id: job.jobId,
        queue_driver: job.driver,
        status: SubmissionStatus.PENDING,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to enqueue judge job.';
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.RUNTIME_ERROR,
          lastError: message,
          compileMessage: message,
          finishedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException('Judge queue is unavailable.');
    }
  }

  async findOne(id: string, reader: SubmissionReader) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" not found.`);
    }

    if (!this.canReadSubmission(submission.userId, reader)) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return {
      submission_id: submission.id,
      judge_job_id: submission.judgeJobId || '',
      problem_id: submission.problemId.toString(),
      language: submission.language,
      status: submission.status,
      score: submission.score.toString(),
      user_answer: submission.userOutput || '',
      compile_message: submission.compileMessage,
      last_error: submission.lastError || '',
      metrics: {
        execution_time_ms: submission.executionTimeMs?.toString() || '0',
        memory_usage_kb: submission.memoryUsageKb?.toString() || '0',
      },
      queued_at: submission.queuedAt,
      started_at: submission.startedAt,
      finished_at: submission.finishedAt,
      submitted_at: submission.createdAt,
    };
  }

  private canReadSubmission(ownerUserId: string, reader: SubmissionReader) {
    return (
      reader.id === ownerUserId ||
      hasAnyUserRole(reader.role, [UserRole.ADMIN, UserRole.EXAMINER])
    );
  }
}
