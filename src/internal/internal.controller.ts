import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { InternalAuthGuard } from './internal-auth.guard.js';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Internal')
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('testcases/:id')
  @UseGuards(InternalAuthGuard)
  @ApiOperation({
    summary: '評測機獲取測資 (Internal)',
    description: '僅供沙盒評測節點拉取題目測資，需提供內部 API Key',
  })
  @ApiHeader({
    name: 'x-internal-api-key',
    description: '內部 API 金鑰',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: '成功取得測資',
    schema: {
      example: {
        problem_id: '1',
        time_limit_ms: '1000',
        memory_limit_mb: '256',
        test_cases: [{ input: '3 5\n', output: '8\n' }],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'API Key 無效' })
  @ApiResponse({ status: 404, description: '題目不存在' })
  async getTestCases(@Param('id', ParseIntPipe) problemId: number) {
    const problem = await this.prisma.problem.findFirst({
      where: { id: problemId, isDeleted: false },
      include: {
        testCases: {
          select: { input: true, output: true },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException(`Problem #${problemId} not found.`);
    }

    return {
      problem_id: problem.id.toString(),
      time_limit_ms: problem.timeLimitMs.toString(),
      memory_limit_mb: problem.memoryLimitMb.toString(),
      test_cases: problem.testCases,
    };
  }
}
