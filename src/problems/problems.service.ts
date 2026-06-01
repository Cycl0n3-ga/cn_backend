import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasUserRole, UserRole } from '../auth/user-role.js';
import { SubmissionStatus } from '../submissions/submission-status.js';

type ProblemFindAllWhere = {
  isDeleted: boolean;
  difficulty?: string;
};

const FAILED_SUBMISSION_STATUSES = [
  SubmissionStatus.WRONG_ANSWER,
  SubmissionStatus.TLE,
  SubmissionStatus.MLE,
  SubmissionStatus.RUNTIME_ERROR,
  SubmissionStatus.COMPILE_ERROR,
] as const;

type FailedSubmissionStatus = (typeof FAILED_SUBMISSION_STATUSES)[number];

type ProblemAnalytics = {
  assignedCount: number;
  submittedCount: number;
  acceptedCount: number;
  failedCount: number;
};

type ProblemCreator = {
  id: string;
  username: string;
  email: string | null;
} | null;

@Injectable()
export class ProblemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, difficulty?: string) {
    const where: ProblemFindAllWhere = { isDeleted: false };
    if (difficulty) {
      where.difficulty = difficulty.toUpperCase();
    }

    const [total, items] = await Promise.all([
      this.prisma.problem.count({ where }),
      this.prisma.problem.findMany({
        where,
        select: {
          id: true,
          title: true,
          difficulty: true,
          acceptanceRate: true,
          creator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);
    const analytics = await this.getProblemAnalytics(items.map((p) => p.id));

    return {
      total: total.toString(),
      page: page.toString(),
      items: items.map((p) => ({
        problem_id: p.id.toString(),
        title: p.title,
        difficulty: p.difficulty,
        acceptance_rate: p.acceptanceRate.toString(),
        creator: this.formatCreator(p.creator),
        ...this.formatAnalytics(analytics.get(p.id)),
      })),
    };
  }

  async findOne(id: number) {
    const problem = await this.prisma.problem.findFirst({
      where: { id, isDeleted: false },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        testCases: {
          where: { isHidden: false },
          select: { input: true, output: true },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException(`Problem #${id} not found.`);
    }
    const analytics = await this.getProblemAnalytics([problem.id]);

    return {
      problem_id: problem.id.toString(),
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      function_name: problem.functionName || '',
      creator: this.formatCreator(problem.creator),
      ...this.formatAnalytics(analytics.get(problem.id)),
      constraints: {
        time_limit_ms: problem.timeLimitMs.toString(),
        memory_limit_mb: problem.memoryLimitMb.toString(),
      },
      sample_test_cases: problem.testCases,
    };
  }

  async create(data: {
    title: string;
    description: string;
    difficulty: string;
    functionName?: string;
    creatorId?: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    testCases: { input: string; output: string; isHidden?: boolean }[];
  }) {
    this.assertHasTestCases(data.testCases);

    const problem = await this.prisma.problem.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        functionName: data.functionName,
        creatorId: data.creatorId,
        timeLimitMs: data.timeLimitMs || 1000,
        memoryLimitMb: data.memoryLimitMb || 256,
        testCases: {
          create: data.testCases.map((tc) => ({
            input: tc.input,
            output: tc.output,
            isHidden: tc.isHidden ?? true,
          })),
        },
      },
      include: {
        testCases: true,
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return {
      problem_id: problem.id.toString(),
      title: problem.title,
      creator: this.formatCreator(problem.creator),
    };
  }

  async update(
    id: number,
    data: {
      title?: string;
      description?: string;
      difficulty?: string;
      functionName?: string;
      timeLimitMs?: number;
      memoryLimitMb?: number;
      testCases?: { input: string; output: string; isHidden?: boolean }[];
    },
  ) {
    if (!this.hasUpdatePayload(data)) {
      throw new BadRequestException('At least one field must be provided.');
    }
    if (data.testCases !== undefined) {
      this.assertHasTestCases(data.testCases);
    }

    const existing = await this.prisma.problem.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) {
      throw new NotFoundException(`Problem #${id} not found.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (data.testCases) {
        await tx.testCase.deleteMany({
          where: { problemId: id },
        });
      }

      return tx.problem.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          functionName: data.functionName,
          timeLimitMs: data.timeLimitMs,
          memoryLimitMb: data.memoryLimitMb,
          testCases: data.testCases
            ? {
                create: data.testCases.map((tc) => ({
                  input: tc.input,
                  output: tc.output,
                  isHidden: tc.isHidden ?? true,
                })),
              }
            : undefined,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          testCases: {
            where: { isHidden: false },
            select: { input: true, output: true },
          },
        },
      });
    });
    const analytics = await this.getProblemAnalytics([updated.id]);

    return {
      problem_id: updated.id.toString(),
      title: updated.title,
      description: updated.description,
      difficulty: updated.difficulty,
      function_name: updated.functionName || '',
      creator: this.formatCreator(updated.creator),
      ...this.formatAnalytics(analytics.get(updated.id)),
      constraints: {
        time_limit_ms: updated.timeLimitMs.toString(),
        memory_limit_mb: updated.memoryLimitMb.toString(),
      },
      sample_test_cases: updated.testCases,
    };
  }

  async remove(id: number) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) {
      throw new NotFoundException(`Problem #${id} not found.`);
    }

    // Soft delete
    await this.prisma.problem.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async assign(problemId: number, assigneeUsername: string) {
    const problem = await this.prisma.problem.findFirst({
      where: { id: problemId, isDeleted: false },
    });
    if (!problem) {
      throw new NotFoundException(`Problem #${problemId} not found.`);
    }

    const user = await this.prisma.user.findUnique({
      where: { username: assigneeUsername },
    });
    if (!user) {
      throw new NotFoundException(`User "${assigneeUsername}" not found.`);
    }
    if (!hasUserRole(user.role, UserRole.CANDIDATE)) {
      throw new BadRequestException(
        'assignee_username must belong to a CANDIDATE user.',
      );
    }

    const assignment = await this.prisma.assignment.upsert({
      where: {
        problemId_userId: { problemId, userId: user.id },
      },
      update: {},
      create: { problemId, userId: user.id },
    });

    return {
      message: 'Assignment created successfully.',
      assignment_id: assignment.id.toString(),
      problem_id: problemId.toString(),
      assignee: assigneeUsername,
    };
  }

  private async getProblemAnalytics(problemIds: number[]) {
    const analytics = new Map<number, ProblemAnalytics>();
    for (const problemId of problemIds) {
      analytics.set(problemId, {
        assignedCount: 0,
        submittedCount: 0,
        acceptedCount: 0,
        failedCount: 0,
      });
    }

    if (problemIds.length === 0) {
      return analytics;
    }

    const [assignmentCounts, submissionStatusCounts] = await Promise.all([
      this.prisma.assignment.groupBy({
        by: ['problemId'],
        where: { problemId: { in: problemIds } },
        _count: { _all: true },
      }),
      this.prisma.submission.groupBy({
        by: ['problemId', 'status'],
        where: { problemId: { in: problemIds } },
        _count: { _all: true },
      }),
    ]);

    for (const row of assignmentCounts) {
      const item = analytics.get(row.problemId);
      if (item) {
        item.assignedCount = row._count._all;
      }
    }

    for (const row of submissionStatusCounts) {
      const item = analytics.get(row.problemId);
      if (!item) {
        continue;
      }

      const count = row._count._all;
      item.submittedCount += count;

      if (row.status === 'ACCEPTED') {
        item.acceptedCount += count;
      } else if (
        FAILED_SUBMISSION_STATUSES.includes(
          row.status as FailedSubmissionStatus,
        )
      ) {
        item.failedCount += count;
      }
    }

    return analytics;
  }

  private formatAnalytics(analytics?: ProblemAnalytics) {
    const value = analytics ?? {
      assignedCount: 0,
      submittedCount: 0,
      acceptedCount: 0,
      failedCount: 0,
    };

    return {
      assignedCount: value.assignedCount.toString(),
      submittedCount: value.submittedCount.toString(),
      acceptedCount: value.acceptedCount.toString(),
      failedCount: value.failedCount.toString(),
    };
  }

  private formatCreator(creator: ProblemCreator) {
    if (!creator) {
      return null;
    }

    return {
      id: creator.id,
      username: creator.username,
      email: creator.email,
    };
  }

  private assertHasTestCases(
    testCases: { input: string; output: string; isHidden?: boolean }[],
  ) {
    if (testCases.length === 0) {
      throw new BadRequestException(
        'test_cases must contain at least one item.',
      );
    }
  }

  private hasUpdatePayload(data: {
    title?: string;
    description?: string;
    difficulty?: string;
    functionName?: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    testCases?: { input: string; output: string; isHidden?: boolean }[];
  }) {
    return Object.values(data).some((value) => value !== undefined);
  }
}
