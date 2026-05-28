import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JudgeQueueService } from 'src/judge/judge-queue.service';
import { PrismaService } from 'src/prisma/prisma.service';

export type CreateSubmissionInput = {
  assignmentId: number;
  userId: number;
  language: string;
  code: string;
};

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  async create(input: CreateSubmissionInput) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: input.assignmentId },
      include: { question: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment was not found.');
    }

    if (assignment.userId !== input.userId) {
      throw new BadRequestException('This assignment does not belong to userId.');
    }

    const submission = await this.prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        userId: input.userId,
        questionId: assignment.questionId,
        language: input.language,
        code: input.code,
        status: 'PENDING',
        expectedOutput: assignment.question.testcaseAns,
      },
      include: this.includeRelations(),
    });

    void this.processSubmission(submission.id, {
      language: input.language,
      code: input.code,
      testcase: assignment.question.testcase,
      testcaseAns: assignment.question.testcaseAns,
    });

    return submission;
  }

  private async processSubmission(
    submissionId: number,
    input: {
      language: string;
      code: string;
      testcase: string;
      testcaseAns: string;
    },
  ) {
    try {
      const result = await this.judgeQueueService.enqueue(
        {
          language: input.language,
          code: input.code,
          input: input.testcase,
          expectedOutput: input.testcaseAns,
        },
        async () => {
          await this.prisma.submission.update({
            where: { id: submissionId },
            data: { status: 'RUNNING' },
          });
        },
      );

      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          expectedOutput: result.expectedOutput,
          score: result.score,
          executionTimeMs: result.executionTimeMs,
        },
      });
    } catch (error) {
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: 'INTERNAL_ERROR',
          stderr: error instanceof Error ? error.message : String(error),
          score: 0,
        },
      });
    }
  }

  findAll() {
    return this.prisma.submission.findMany({
      include: this.includeRelations(),
      orderBy: { id: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.submission.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
  }

  findByUser(userId: number) {
    return this.prisma.submission.findMany({
      where: { userId },
      include: this.includeRelations(),
      orderBy: { id: 'desc' },
    });
  }

  private includeRelations() {
    return {
      assignment: true,
      question: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          empId: true,
          isCandidate: true,
        },
      },
    };
  }
}
