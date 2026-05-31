import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto.js';

const DIFFICULTY_CONFIGS = [
  { field: 'easy', difficulty: 'EASY' },
  { field: 'medium', difficulty: 'MEDIUM' },
  { field: 'hard', difficulty: 'HARD' },
] as const;

type Difficulty = (typeof DIFFICULTY_CONFIGS)[number]['difficulty'];

type ProblemCountsByDifficulty = Record<Difficulty, number>;

type InterviewRecord = {
  id: number;
  jobRole: string;
  examinerEmpId: string;
};

type CandidateRecord = {
  id: number;
  jobId: number;
  userId: string;
};

type AssignableProblem = {
  id: number;
  title: string;
  difficulty: string;
};

type InterviewAssignmentRecord = {
  id: number;
  jobId: number;
  userId: string;
  problemId: number;
  createdAt: Date;
  problem: AssignableProblem;
};

type InterviewResponse = {
  id: string;
  jobRole: string;
  examinerEmpId: string;
  candidate?: {
    id: string;
    jobId: string;
    userId: string;
  };
  problemCounts?: {
    easy: number;
    medium: number;
    hard: number;
  };
  assignments?: {
    id: string;
    jobId: string;
    userId: string;
    problemId: string;
    createdAt: Date;
    problem: AssignableProblem;
  }[];
};

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(examinerId: string, createInterviewDto: CreateInterviewDto) {
    const problemCounts = this.normalizeProblemCounts(
      createInterviewDto.problemCounts,
    );
    const requestedProblemCount = this.getRequestedProblemCount(problemCounts);

    if (!createInterviewDto.candidateUserId && requestedProblemCount > 0) {
      throw new BadRequestException(
        'candidateUserId is required when assigning interview problems.',
      );
    }

    if (createInterviewDto.candidateUserId) {
      const candidate = await this.prisma.user.findUnique({
        where: { id: createInterviewDto.candidateUserId },
      });
      if (!candidate) {
        throw new NotFoundException(
          `User #${createInterviewDto.candidateUserId} not found.`,
        );
      }

      const problems = await this.findAssignableProblems(problemCounts);

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const interview = await tx.interview.create({
            data: {
              jobRole: createInterviewDto.jobRole,
              examinerEmpId: examinerId,
            },
          });

          const interviewCandidate = await tx.interviewCandidate.create({
            data: {
              jobId: interview.id,
              userId: createInterviewDto.candidateUserId!,
            },
          });

          const assignments = await Promise.all(
            problems.map((problem) =>
              tx.interviewAssignment.create({
                data: {
                  jobId: interview.id,
                  userId: createInterviewDto.candidateUserId!,
                  problemId: problem.id,
                },
                include: {
                  problem: {
                    select: { id: true, title: true, difficulty: true },
                  },
                },
              }),
            ),
          );

          return { interview, interviewCandidate, assignments };
        });

        return this.formatInterview(
          result.interview,
          result.interviewCandidate,
          result.assignments,
          problemCounts,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          (error as { code?: string }).code === 'P2003'
        ) {
          throw new BadRequestException('Invalid candidateUserId.');
        }
        throw error;
      }
    }

    const interview = await this.prisma.interview.create({
      data: {
        jobRole: createInterviewDto.jobRole,
        examinerEmpId: examinerId,
      },
    });

    return this.formatInterview(interview);
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [total, interviews] = await Promise.all([
      this.prisma.interview.count(),
      this.prisma.interview.findMany({ skip, take: limit }),
    ]);
    return {
      data: interviews.map((i) => this.formatInterview(i)),
      total,
      page,
      limit,
    };
  }

  async update(id: number, updateInterviewDto: UpdateInterviewDto) {
    try {
      const updated = await this.prisma.interview.update({
        where: { id },
        data: { jobRole: updateInterviewDto.jobRole },
      });
      return this.formatInterview(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Interview #${id} not found.`);
      }
      throw error;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.interview.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Interview #${id} not found.`);
      }
      throw error;
    }
  }

  private async findAssignableProblems(
    problemCounts: ProblemCountsByDifficulty,
  ) {
    const problemGroups = await Promise.all(
      DIFFICULTY_CONFIGS.map(async ({ difficulty }) => {
        const count = problemCounts[difficulty];
        if (count === 0) {
          return [];
        }

        const allProblems = await this.prisma.problem.findMany({
          where: { difficulty, isDeleted: false },
          select: { id: true, title: true, difficulty: true },
        });

        if (allProblems.length < count) {
          throw new BadRequestException(
            `Not enough ${difficulty} problems. Requested ${count}, available ${allProblems.length}.`,
          );
        }

        const shuffled = allProblems.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
      }),
    );

    return problemGroups.flat();
  }

  private normalizeProblemCounts(
    problemCounts: CreateInterviewDto['problemCounts'],
  ): ProblemCountsByDifficulty {
    const normalized = {
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
    };

    for (const { field, difficulty } of DIFFICULTY_CONFIGS) {
      const value = problemCounts?.[field] ?? 0;
      if (!Number.isInteger(value) || value < 0) {
        throw new BadRequestException(
          `${field} must be a non-negative integer.`,
        );
      }
      normalized[difficulty] = value;
    }

    return normalized;
  }

  private getRequestedProblemCount(problemCounts: ProblemCountsByDifficulty) {
    return DIFFICULTY_CONFIGS.reduce(
      (total, { difficulty }) => total + problemCounts[difficulty],
      0,
    );
  }

  private formatInterview(
    interview: InterviewRecord,
    candidate?: CandidateRecord,
    assignments?: InterviewAssignmentRecord[],
    problemCounts?: ProblemCountsByDifficulty,
  ): InterviewResponse {
    const response: InterviewResponse = {
      id: interview.id.toString(),
      jobRole: interview.jobRole,
      examinerEmpId: interview.examinerEmpId,
    };

    if (candidate) {
      response.candidate = {
        id: candidate.id.toString(),
        jobId: candidate.jobId.toString(),
        userId: candidate.userId,
      };
    }

    if (problemCounts) {
      response.problemCounts = {
        easy: problemCounts.EASY,
        medium: problemCounts.MEDIUM,
        hard: problemCounts.HARD,
      };
    }

    if (assignments) {
      response.assignments = assignments.map((assignment) => ({
        id: assignment.id.toString(),
        jobId: assignment.jobId.toString(),
        userId: assignment.userId,
        problemId: assignment.problemId.toString(),
        createdAt: assignment.createdAt,
        problem: assignment.problem,
      }));
    }

    return response;
  }
}
