import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeQueueService } from '../judge/judge-queue.service.js';
import { type JudgeResult } from '../judge/judge.service.js';

// Status enum values
const STATUS = {
  PENDING: 'PENDING',
  COMPILING: 'COMPILING',
  RUNNING: 'RUNNING',
  ACCEPTED: 'ACCEPTED',
  WRONG_ANSWER: 'WRONG_ANSWER',
  TLE: 'TLE',
  MLE: 'MLE',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  COMPILE_ERROR: 'COMPILE_ERROR',
} as const;

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
    // Verify problem exists
    const problem = await this.prisma.problem.findFirst({
      where: { id: data.problemId, isDeleted: false },
    });
    if (!problem) {
      throw new NotFoundException(`Problem #${data.problemId} not found.`);
    }

    // Create submission with PENDING status
    const submission = await this.prisma.submission.create({
      data: {
        userId,
        problemId: data.problemId,
        language: normalizedLanguage,
        sourceCode: data.sourceCode,
        status: STATUS.PENDING,
      },
    });

    // Run judge asynchronously (in production, this would push to a message queue)
    void this.runJudgeForSubmission({
      submissionId: submission.id,
      problemId: data.problemId,
      userId,
      language: normalizedLanguage,
      sourceCode: data.sourceCode,
    });

    return {
      submission_id: submission.id,
      status: STATUS.PENDING,
    };
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" not found.`);
    }

    return {
      submission_id: submission.id,
      problem_id: submission.problemId.toString(),
      language: submission.language,
      status: submission.status,
      score: submission.score.toString(),
      user_answer: submission.userOutput || '',
      compile_message: submission.compileMessage,
      metrics: {
        execution_time_ms: submission.executionTimeMs?.toString() || '0',
        memory_usage_kb: submission.memoryUsageKb?.toString() || '0',
      },
      submitted_at: submission.createdAt,
    };
  }

  private async runJudgeForSubmission(input: {
    submissionId: string;
    problemId: number;
    userId: string;
    language: string;
    sourceCode: string;
  }) {
    try {
      const testCases = await this.prisma.testCase.findMany({
        where: { problemId: input.problemId },
        orderBy: { id: 'asc' },
      });

      if (testCases.length === 0) {
        await this.prisma.submission.update({
          where: { id: input.submissionId },
          data: {
            status: STATUS.RUNTIME_ERROR,
            score: 0,
            compileMessage: 'No test cases found for this problem.',
            executionTimeMs: 0,
          },
        });
        return;
      }

      let finalStatus: string = STATUS.ACCEPTED;
      let totalTimeMs = 0;
      let lastStdout = '';
      let lastStderr = '';

      for (const testCase of testCases) {
        const result = await this.judgeQueueService.enqueue(
          {
            language: input.language,
            code: input.sourceCode,
            input: testCase.input,
            expectedOutput: testCase.output,
          },
          async () => {
            await this.prisma.submission.update({
              where: { id: input.submissionId },
              data: { status: STATUS.RUNNING },
            });
          },
        );

        totalTimeMs += result.executionTimeMs;
        lastStdout = result.stdout;
        lastStderr = result.stderr;

        const mappedStatus = this.mapJudgeStatus(result.status);
        if (mappedStatus !== STATUS.ACCEPTED) {
          finalStatus = mappedStatus;
          break;
        }
      }

      const score = finalStatus === STATUS.ACCEPTED ? 100 : 0;

      await this.prisma.submission.update({
        where: { id: input.submissionId },
        data: {
          status: finalStatus,
          score,
          userOutput: lastStdout,
          compileMessage: lastStderr,
          executionTimeMs: totalTimeMs,
        },
      });

      if (finalStatus === STATUS.ACCEPTED) {
        await this.updateUserStatsIfFirstAccepted(
          input.submissionId,
          input.userId,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown judge error.';
      await this.prisma.submission.update({
        where: { id: input.submissionId },
        data: {
          status: STATUS.RUNTIME_ERROR,
          score: 0,
          compileMessage: message,
        },
      });
    }
  }

  private async updateUserStatsIfFirstAccepted(
    submissionId: string,
    userId: string,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) {
      return;
    }

    const previousAccepted = await this.prisma.submission.count({
      where: {
        userId,
        problemId: submission.problemId,
        status: STATUS.ACCEPTED,
        id: { not: submissionId },
      },
    });

    if (previousAccepted === 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          solvedCount: { increment: 1 },
          rating: { increment: 10 },
        },
      });
    }
  }

  private mapJudgeStatus(status: JudgeResult['status']) {
    switch (status) {
      case 'ACCEPTED':
        return STATUS.ACCEPTED;
      case 'WRONG_ANSWER':
        return STATUS.WRONG_ANSWER;
      case 'TIME_LIMIT_EXCEEDED':
        return STATUS.TLE;
      case 'RUNTIME_ERROR':
        return STATUS.RUNTIME_ERROR;
      case 'INTERNAL_ERROR':
        return STATUS.RUNTIME_ERROR;
      default:
        return STATUS.RUNTIME_ERROR;
    }
  }
}
