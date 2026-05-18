import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service.js';
import { CreateSubmissionDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@ApiTags('Submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '提交程式碼',
    description: '將程式碼推入評測佇列，回傳提交 ID 供後續輪詢',
  })
  @ApiResponse({
    status: 202,
    description: '提交成功（非同步評測中）',
    schema: {
      example: {
        submission_id: 'uuid-v4-string',
        status: 'PENDING',
      },
    },
  })
  @ApiResponse({ status: 401, description: '未認證' })
  @ApiResponse({ status: 404, description: '題目不存在' })
  create(@Request() req: any, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(req.user.id, {
      problemId: dto.problem_id,
      language: dto.language,
      sourceCode: dto.source_code,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: '查詢提交結果',
    description: '前端透過輪詢此端點取得評測狀態與結果',
  })
  @ApiResponse({
    status: 200,
    description: '成功取得提交詳情',
    schema: {
      example: {
        submission_id: 'uuid',
        problem_id: '1',
        language: 'python3',
        status: 'ACCEPTED',
        score: '100',
        user_answer: '[0,1]',
        compile_message: '',
        metrics: {
          execution_time_ms: '45',
          memory_usage_kb: '2048',
        },
        submitted_at: '2026-05-09T14:30:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: '提交不存在' })
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }
}
