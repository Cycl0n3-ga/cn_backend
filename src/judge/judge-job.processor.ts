import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeInput, JudgeResult, JudgeService } from './judge.service.js';
import {
  isTerminalSubmissionStatus,
  SubmissionStatus,
} from '../submissions/submission-status.js';
import { type JudgeJobContext } from './judge-jobs.js';

@Injectable()
export class JudgeJobProcessor {
  private readonly logger = new Logger(JudgeJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeService: JudgeService,
  ) {}

  async processSubmission(submissionId: string, context: JudgeJobContext) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { problem: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${submissionId}" not found.`);
    }

    if (
      isTerminalSubmissionStatus(submission.status) &&
      submission.finishedAt != null
    ) {
      this.logger.log(
        JSON.stringify({
          event: 'judge_submission_skip_terminal',
          submissionId,
          jobId: context.jobId,
          status: submission.status,
        }),
      );
      return;
    }

    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.RUNNING,
        judgeJobId: context.jobId,
        startedAt: new Date(),
        attempts: context.attempt,
        lastError: null,
      },
    });

    try {
      await this.runSubmissionTestCases({
        submissionId,
        userId: submission.userId,
        problemId: submission.problemId,
        language: submission.language,
        sourceCode: submission.sourceCode,
        timeLimitMs: submission.problem.timeLimitMs,
        memoryLimitMb: submission.problem.memoryLimitMb,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown judge error.';
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.RUNTIME_ERROR,
          score: 0,
          compileMessage: message,
          lastError: message,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async runSample(input: JudgeInput) {
    return this.judgeService.run(input);
  }

  private async runSubmissionTestCases(input: {
    submissionId: string;
    userId: string;
    problemId: number;
    language: string;
    sourceCode: string;
    timeLimitMs: number;
    memoryLimitMb: number;
  }) {
    const testCases = await this.prisma.testCase.findMany({
      where: { problemId: input.problemId },
      orderBy: { id: 'asc' },
    });

    if (testCases.length === 0) {
      await this.prisma.submission.update({
        where: { id: input.submissionId },
        data: {
          status: SubmissionStatus.RUNTIME_ERROR,
          score: 0,
          compileMessage: 'No test cases found for this problem.',
          executionTimeMs: 0,
          finishedAt: new Date(),
        },
      });
      return;
    }

    let finalStatus: SubmissionStatus = SubmissionStatus.ACCEPTED;
    let totalTimeMs = 0;
    let lastStdout = '';
    let lastStderr = '';

    for (const testCase of testCases) {
      const result = await this.judgeService.run({
        language: input.language,
        code: input.sourceCode,
        input: testCase.input,
        expectedOutput: testCase.output,
        timeLimitMs: input.timeLimitMs,
        memoryLimitMb: input.memoryLimitMb,
      });

      totalTimeMs += result.executionTimeMs;
      lastStdout = result.stdout;
      lastStderr = result.stderr;

      const mappedStatus = this.mapJudgeStatus(result.status);
      if (mappedStatus !== SubmissionStatus.ACCEPTED) {
        finalStatus = mappedStatus;
        break;
      }
    }

    const score = finalStatus === SubmissionStatus.ACCEPTED ? 100 : 0;

    await this.prisma.submission.update({
      where: { id: input.submissionId },
      data: {
        status: finalStatus,
        score,
        userOutput: lastStdout,
        compileMessage: lastStderr,
        executionTimeMs: totalTimeMs,
        finishedAt: new Date(),
      },
    });

    if (finalStatus === SubmissionStatus.ACCEPTED) {
      await this.updateUserStatsIfFirstAccepted(
        input.submissionId,
        input.userId,
      );
    }
  }

  private async updateUserStatsIfFirstAccepted(
    submissionId: string,
    userId: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
      });
      if (!submission) {
        return;
      }

      const previousAccepted = await tx.submission.count({
        where: {
          userId,
          problemId: submission.problemId,
          status: SubmissionStatus.ACCEPTED,
          id: { not: submissionId },
        },
      });

      if (previousAccepted === 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            solvedCount: { increment: 1 },
            rating: { increment: 10 },
          },
        });
      }
    });
  }

  private mapJudgeStatus(status: JudgeResult['status']) {
    switch (status) {
      case 'ACCEPTED':
        return SubmissionStatus.ACCEPTED;
      case 'WRONG_ANSWER':
        return SubmissionStatus.WRONG_ANSWER;
      case 'TIME_LIMIT_EXCEEDED':
        return SubmissionStatus.TLE;
      case 'RUNTIME_ERROR':
        return SubmissionStatus.RUNTIME_ERROR;
      case 'INTERNAL_ERROR':
        return SubmissionStatus.RUNTIME_ERROR;
      default:
        return SubmissionStatus.RUNTIME_ERROR;
    }
  }
}
