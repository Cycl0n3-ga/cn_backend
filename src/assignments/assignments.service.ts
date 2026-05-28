import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type CreateAssignmentInput = {
  jobId: number;
  userId: number;
  questionId: number;
};

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAssignmentInput) {
    return this.prisma.assignment.create({
      data: input,
      include: this.includeRelations(),
    });
  }

  findAll() {
    return this.prisma.assignment.findMany({
      include: this.includeRelations(),
      orderBy: { id: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.assignment.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
  }

  findByUser(userId: number) {
    return this.prisma.assignment.findMany({
      where: { userId },
      include: this.includeRelations(),
      orderBy: { id: 'asc' },
    });
  }

  private includeRelations() {
    return {
      interview: true,
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
