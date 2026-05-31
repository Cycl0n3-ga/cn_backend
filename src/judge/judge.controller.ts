import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeQueueService } from './judge-queue.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RunDto {
  @ApiProperty({ example: 1, description: '題目 ID' })
  @IsInt()
  problem_id: number;

  @ApiProperty({ example: 'python', enum: ['javascript', 'python', 'c', 'cpp'] })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  language: string;

  @ApiProperty({ example: 'def solve(input): return input', description: '原始碼（最大 64KB）' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(65536)
  source_code: string;
}

@ApiTags('Judge')
@Controller('judge')
export class JudgeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  @Post('run')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '使用公開範例測資執行程式碼',
    description: 'Run button 使用，不會建立正式 submission 紀錄。需要認證。',
  })
  @ApiResponse({ status: 200, description: '成功回傳 sample 執行結果' })
  @ApiResponse({ status: 401, description: '未認證' })
  async runSample(@Body() dto: RunDto) {
    const problem = await this.prisma.problem.findFirst({
      where: { id: dto.problem_id, isDeleted: false },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { id: 'asc' },
          take: 1,
        },
      },
    });

    if (!problem) {
      throw new NotFoundException(`Problem #${dto.problem_id} not found.`);
    }

    const sample = problem.testCases[0];
    if (!sample) {
      throw new NotFoundException(
        `Problem #${dto.problem_id} has no public sample test case.`,
      );
    }

    return this.judgeQueueService.enqueue({
      language: dto.language,
      code: dto.source_code,
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

