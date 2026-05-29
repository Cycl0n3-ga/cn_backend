import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProblemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, difficulty?: string) {
    const where: Prisma.ProblemWhereInput = { isDeleted: false };
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
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'asc' },
      }),
    ]);

    return {
      total: total.toString(),
      page: page.toString(),
      items: items.map((p) => ({
        problem_id: p.id.toString(),
        title: p.title,
        difficulty: p.difficulty,
        acceptance_rate: p.acceptanceRate.toString(),
      })),
    };
  }

  async findOne(id: number) {
    const problem = await this.prisma.problem.findFirst({
      where: { id, isDeleted: false },
      include: {
        testCases: {
          where: { isHidden: false },
          select: { input: true, output: true },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException(`Problem #${id} not found.`);
    }

    return {
      problem_id: problem.id.toString(),
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      function_name: problem.functionName || '',
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
    timeLimitMs?: number;
    memoryLimitMb?: number;
    testCases: { input: string; output: string; isHidden?: boolean }[];
  }) {
    const problem = await this.prisma.problem.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        functionName: data.functionName,
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
      include: { testCases: true },
    });

    return { problem_id: problem.id.toString(), title: problem.title };
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
}
