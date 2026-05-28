import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JudgeQueueService } from './judge-queue.service';

type RunBody = {
  questionId?: number;
  language?: string;
  code?: string;
};

@Controller('judge')
export class JudgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  @Post('run')
  async runSample(@Body() body: RunBody) {
    const questionId = Number(body.questionId);
    const language = body.language?.trim();
    const code = body.code?.trim();

    if (!Number.isInteger(questionId) || !language || !code) {
      throw new BadRequestException(
        'questionId, language, and code are required.',
      );
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question was not found.');
    }

    return this.judgeQueueService.enqueue({
      language,
      code,
      input: question.example,
      expectedOutput: question.exampleAns,
    });
  }

  @Get('queue')
  getQueueStats() {
    return this.judgeQueueService.getStats();
  }
}
