import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeQueueService } from './judge-queue.service.js';

type RunBody = {
  problem_id?: number;
  language?: string;
  source_code?: string;
};

@ApiTags('Judge')
@Controller('judge')
export class JudgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  @Post('run')
  @ApiOperation({
    summary: '使用公開範例測資執行程式碼',
    description: 'Run button 使用，不會建立正式 submission 紀錄。',
  })
  @ApiResponse({ status: 200, description: '成功回傳 sample 執行結果' })
  async runSample(@Body() body: RunBody) {
    const problemId = Number(body.problem_id);
    const language = body.language?.trim();
    const sourceCode = body.source_code?.trim();

    if (!Number.isInteger(problemId) || !language || !sourceCode) {
      throw new BadRequestException(
        'problem_id, language, and source_code are required.',
      );
    }

    const problem = await this.prisma.problem.findFirst({
      where: { id: problemId, isDeleted: false },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { id: 'asc' },
          take: 1,
        },
      },
    });

    if (!problem) {
      throw new NotFoundException(`Problem #${problemId} not found.`);
    }

    const sample = problem.testCases[0];
    if (!sample) {
      throw new NotFoundException(
        `Problem #${problemId} has no public sample test case.`,
      );
    }

    return this.judgeQueueService.enqueue({
      language,
      code: sourceCode,
      input: sample.input,
      expectedOutput: sample.output,
    });
  }

  @Get('queue')
  @ApiOperation({ summary: '查詢 judge queue 狀態' })
  getQueueStats() {
    return this.judgeQueueService.getStats();
  }
}
