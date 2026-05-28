import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { InterviewsService } from './interviews.service';

type CreateInterviewBody = {
  jobRole?: string;
  examinerEmpId?: string;
};

@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  create(@Body() body: CreateInterviewBody) {
    const jobRole = body.jobRole?.trim();
    const examinerEmpId = body.examinerEmpId?.trim();

    if (!jobRole || !examinerEmpId) {
      throw new BadRequestException('jobRole and examinerEmpId are required.');
    }

    return this.interviewsService.create(jobRole, examinerEmpId);
  }
}
