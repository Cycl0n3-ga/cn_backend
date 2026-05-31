import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hasPrismaErrorCode } from '../prisma/prisma-errors.js';
import {
  CreateInterviewCandidateDto,
  UpdateInterviewCandidateTimeDto,
} from './dto/interview-candidate.dto.js';

type InterviewCandidateRecord = {
  id: number;
  jobId: number;
  userId: string;
  startTime: number | null;
  endTime: number | null;
};

@Injectable()
export class InterviewCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInterviewCandidateDto: CreateInterviewCandidateDto) {
    const { jobId, userId, startTime, endTime } = createInterviewCandidateDto;
    this.validateTimeRange(startTime, endTime);

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
          ...(startTime !== undefined ? { startTime } : {}),
          ...(endTime !== undefined ? { endTime } : {}),
        },
      });

      return this.formatCandidate(candidate);
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
      startTime: c.startTime,
      endTime: c.endTime,
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

  async updateTime(id: number, dto: UpdateInterviewCandidateTimeDto) {
    const candidate = await this.prisma.interviewCandidate.findUnique({
      where: { id },
    });
    if (!candidate) {
      throw new NotFoundException(`InterviewCandidate #${id} not found.`);
    }

    const nextStartTime =
      dto.startTime !== undefined ? dto.startTime : candidate.startTime;
    const nextEndTime =
      dto.endTime !== undefined ? dto.endTime : candidate.endTime;
    this.validateTimeRange(nextStartTime, nextEndTime);

    const data: { startTime?: number | null; endTime?: number | null } = {};
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;

    if (Object.keys(data).length === 0) {
      return this.formatCandidate(candidate);
    }

    const updated = await this.prisma.interviewCandidate.update({
      where: { id },
      data,
    });

    return this.formatCandidate(updated);
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

  private validateTimeRange(
    startTime?: number | null,
    endTime?: number | null,
  ) {
    if (startTime == null || endTime == null) {
      return;
    }

    if (endTime < startTime) {
      throw new BadRequestException(
        'endTime must be greater than or equal to startTime.',
      );
    }
  }

  private formatCandidate(candidate: InterviewCandidateRecord) {
    return {
      id: candidate.id.toString(),
      jobId: candidate.jobId.toString(),
      userId: candidate.userId,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
    };
  }
}
