import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type CreateProblemInput = {
  title: string;
  prompt: string;
  example: string;
  exampleAns: string;
  testcase: string;
  testcaseAns: string;
  authorUserId: number;
};

@Injectable()
export class ProblemsService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateProblemInput) {
    return this.prisma.question.create({ data });
  }

  findAll() {
    return this.prisma.question.findMany({
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            empId: true,
            isQuestioner: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.question.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            empId: true,
            isQuestioner: true,
          },
        },
      },
    });
  }
}
