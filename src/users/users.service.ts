import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const [total, users] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          solvedCount: true,
          rating: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total: total.toString(),
      page: page.toString(),
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        solvedCount: u.solvedCount.toString(),
        rating: u.rating.toString(),
        createdAt: u.createdAt,
      })),
    };
  }

  async getSubmissionHistory(username: string, page = 1, limit = 20) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user) {
      throw new NotFoundException(`User "${username}" not found.`);
    }

    const [total, submissions] = await Promise.all([
      this.prisma.submission.count({ where: { userId: user.id } }),
      this.prisma.submission.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          problemId: true,
          language: true,
          status: true,
          score: true,
          sourceCode: true,
          userOutput: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total: total.toString(),
      page: page.toString(),
      data: submissions.map((s) => ({
        submission_id: s.id,
        problem_id: s.problemId.toString(),
        language: s.language,
        status: s.status,
        score: s.score.toString(),
        source_code: s.sourceCode,
        execution_result: s.userOutput || '',
        submitted_at: s.createdAt,
      })),
    };
  }
}
