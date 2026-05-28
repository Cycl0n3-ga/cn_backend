import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('data')
  async getData() {
    const [
      users,
      interviews,
      interviewCandidates,
      questions,
      assignments,
      submissions,
    ] = await Promise.all([
      this.prisma.user.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.interview.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.interviewCandidate.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.question.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.assignment.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.submission.findMany({ orderBy: { id: 'asc' } }),
    ]);

    return {
      users,
      interviews,
      interviewCandidates,
      questions,
      assignments,
      submissions,
    };
  }
}
