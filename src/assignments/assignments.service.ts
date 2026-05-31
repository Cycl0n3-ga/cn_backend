import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasPrismaErrorCode } from '../prisma/prisma-errors.js';
import { CreateInterviewAssignmentDto } from './dto/assignment.dto.js';
import { hasUserRole, UserRole } from '../auth/user-role.js';

type AssignmentInterview = {
  id: number;
  jobRole: string;
  examinerEmpId: string;
};

type AssignmentProblem = {
  id: number;
  title: string;
  difficulty: string;
};

type AssignmentUser = {
  id: string;
  username: string;
  role: string;
};

type AssignmentWithRelations = {
  id: number;
  jobId: number;
  userId: string;
  problemId: number;
  createdAt: Date;
  interview?: AssignmentInterview | null;
  problem: AssignmentProblem;
  user: AssignmentUser;
};

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInterviewAssignmentDto) {
    const { jobId, userId, problemId } = dto;

    // Verify interview exists
    const interview = await this.prisma.interview.findUnique({
      where: { id: jobId },
    });
    if (!interview) {
      throw new NotFoundException(`Interview #${jobId} not found.`);
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User #${userId} not found.`);
    }
    if (!hasUserRole(user.role, UserRole.CANDIDATE)) {
      throw new BadRequestException('userId must belong to a CANDIDATE user.');
    }

    // Verify problem exists
    const problem = await this.prisma.problem.findFirst({
      where: { id: problemId, isDeleted: false },
    });
    if (!problem) {
      throw new NotFoundException(`Problem #${problemId} not found.`);
    }

    try {
      const assignment = await this.prisma.interviewAssignment.create({
        data: { jobId, userId, problemId },
        include: this.includeRelations(),
      });

      return this.formatAssignment(assignment);
    } catch (error) {
      if (hasPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException(
          'This problem is already assigned to the user in this interview.',
        );
      }
      throw error;
    }
  }

  async findAll() {
    const assignments = await this.prisma.interviewAssignment.findMany({
      include: this.includeRelations(),
      orderBy: { id: 'asc' },
    });

    return assignments.map((a) => this.formatAssignment(a));
  }

  async findOne(id: number) {
    const assignment = await this.prisma.interviewAssignment.findUnique({
      where: { id },
      include: this.includeRelations(),
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment #${id} not found.`);
    }

    return this.formatAssignment(assignment);
  }

  async findByUser(userId: string) {
    const assignments = await this.prisma.interviewAssignment.findMany({
      where: { userId },
      include: this.includeRelations(),
      orderBy: { id: 'asc' },
    });

    return assignments.map((a) => this.formatAssignment(a));
  }

  async remove(id: number) {
    const assignment = await this.prisma.interviewAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment #${id} not found.`);
    }

    await this.prisma.interviewAssignment.delete({ where: { id } });
  }

  private includeRelations() {
    return {
      interview: true,
      problem: {
        select: {
          id: true,
          title: true,
          difficulty: true,
        },
      },
      user: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    };
  }

  private formatAssignment(a: AssignmentWithRelations) {
    return {
      id: a.id.toString(),
      jobId: a.jobId.toString(),
      userId: a.userId,
      problemId: a.problemId.toString(),
      createdAt: a.createdAt,
      interview: a.interview
        ? {
            id: a.interview.id.toString(),
            jobRole: a.interview.jobRole,
            examinerEmpId: a.interview.examinerEmpId,
          }
        : undefined,
      problem: a.problem,
      user: a.user,
    };
  }
}
