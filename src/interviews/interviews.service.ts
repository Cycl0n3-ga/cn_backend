import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  create(jobRole: string, examinerEmpId: string) {
    return this.prisma.interview.create({
      data: {
        jobRole,
        examinerEmpId,
      },
    });
  }
}
