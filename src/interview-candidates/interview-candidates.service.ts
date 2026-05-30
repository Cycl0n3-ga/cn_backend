import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasPrismaErrorCode } from '../prisma/prisma-errors.js';
import { CreateInterviewCandidateDto } from './dto/interview-candidate.dto.js';

@Injectable()
export class InterviewCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInterviewCandidateDto: CreateInterviewCandidateDto) {
    const { jobId, userId } = createInterviewCandidateDto;

    // Check if interview exists
    const interview = await this.prisma.interview.findUnique({
      where: { id: jobId },
    });
    if (!interview) {
      throw new NotFoundException(`Interview #${jobId} not found.`);
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User #${userId} not found.`);
    }

    try {
      const candidate = await this.prisma.interviewCandidate.create({
        data: {
          jobId,
          userId,
        },
      });

      return {
        id: candidate.id.toString(),
        jobId: candidate.jobId.toString(),
        userId: candidate.userId,
      };
    } catch (error) {
      if (hasPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException(
          'User is already a candidate for this interview.',
        );
      }
      throw error;
    }
  }

  async findAll() {
    const candidates = await this.prisma.interviewCandidate.findMany({
      include: {
        interview: {
          select: { id: true, jobRole: true, examinerEmpId: true },
        },
        user: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    return candidates.map((c) => ({
      id: c.id.toString(),
      jobId: c.jobId.toString(),
      userId: c.userId,
      createdAt: c.createdAt,
      interview: c.interview
        ? {
            id: c.interview.id.toString(),
            jobRole: c.interview.jobRole,
            examinerEmpId: c.interview.examinerEmpId,
          }
        : undefined,
      user: c.user,
    }));
  }

  async remove(id: number) {
    const candidate = await this.prisma.interviewCandidate.findUnique({
      where: { id },
    });
    if (!candidate) {
      throw new NotFoundException(`InterviewCandidate #${id} not found.`);
    }

    await this.prisma.interviewCandidate.delete({ where: { id } });
    return;
  }
}
