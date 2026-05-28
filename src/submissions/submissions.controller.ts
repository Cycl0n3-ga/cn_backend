import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

type CreateSubmissionBody = {
  assignmentId?: number;
  userId?: number;
  language?: string;
  code?: string;
};

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  create(@Body() body: CreateSubmissionBody) {
    const assignmentId = Number(body.assignmentId);
    const userId = Number(body.userId);
    const language = body.language?.trim().toLowerCase() || 'javascript';
    const code = body.code?.trim();

    if (
      !Number.isInteger(assignmentId) ||
      !Number.isInteger(userId) ||
      !language ||
      !code
    ) {
      throw new BadRequestException(
        'assignmentId, userId, language, and code are required.',
      );
    }

    return this.submissionsService.create({
      assignmentId,
      userId,
      language,
      code,
    });
  }

  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId)) {
      throw new BadRequestException('userId must be a number.');
    }

    return this.submissionsService.findByUser(parsedUserId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const submissionId = Number(id);
    if (!Number.isInteger(submissionId)) {
      throw new BadRequestException('id must be a number.');
    }

    const submission = await this.submissionsService.findOne(submissionId);
    if (!submission) {
      throw new NotFoundException('Submission was not found.');
    }

    return submission;
  }
}
