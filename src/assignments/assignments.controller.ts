import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';

type CreateAssignmentBody = {
  jobId?: number;
  userId?: number;
  questionId?: number;
};

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  create(@Body() body: CreateAssignmentBody) {
    const jobId = Number(body.jobId);
    const userId = Number(body.userId);
    const questionId = Number(body.questionId);

    if (
      !Number.isInteger(jobId) ||
      !Number.isInteger(userId) ||
      !Number.isInteger(questionId)
    ) {
      throw new BadRequestException('jobId, userId, and questionId are required.');
    }

    return this.assignmentsService.create({ jobId, userId, questionId });
  }

  @Get()
  findAll() {
    return this.assignmentsService.findAll();
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId)) {
      throw new BadRequestException('userId must be a number.');
    }

    return this.assignmentsService.findByUser(parsedUserId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const assignmentId = Number(id);
    if (!Number.isInteger(assignmentId)) {
      throw new BadRequestException('id must be a number.');
    }

    const assignment = await this.assignmentsService.findOne(assignmentId);
    if (!assignment) {
      throw new NotFoundException('Assignment was not found.');
    }

    return assignment;
  }
}
