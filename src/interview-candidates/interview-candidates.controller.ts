import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InterviewCandidatesService } from './interview-candidates.service.js';
import { CreateInterviewCandidateDto } from './dto/interview-candidate.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@ApiTags('Interview Candidates')
@Controller('interview-candidates')
export class InterviewCandidatesController {
  constructor(
    private readonly interviewCandidatesService: InterviewCandidatesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '新增面試者到面試',
    description: '將使用者加入指定的面試中',
  })
  @ApiResponse({
    status: 201,
    description: '新增成功，回傳包含 id、jobId、userId 的資料',
  })
  @ApiResponse({ status: 404, description: '面試或使用者不存在' })
  @ApiResponse({ status: 409, description: '使用者已在此面試中' })
  create(@Body() createInterviewCandidateDto: CreateInterviewCandidateDto) {
    return this.interviewCandidatesService.create(createInterviewCandidateDto);
  }

  @Get()
  @ApiOperation({
    summary: '取得所有面試考生列表',
    description: '列出所有面試中的考生記錄（含面試及使用者資訊）',
  })
  @ApiResponse({
    status: 200,
    description: '成功取得清單',
    schema: {
      example: [
        {
          id: '1',
          jobId: '1',
          userId: 'uuid-string',
          createdAt: '2026-05-18T00:00:00Z',
          interview: {
            id: '1',
            jobRole: 'Backend Developer',
            examinerEmpId: 'uuid',
          },
          user: {
            id: 'uuid-string',
            username: 'alice',
            email: 'alice@example.com',
          },
        },
      ],
    },
  })
  findAll() {
    return this.interviewCandidatesService.findAll();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '從面試中移除考生',
    description: '將考生從面試中移除',
  })
  @ApiResponse({ status: 204, description: '移除成功' })
  @ApiResponse({ status: 404, description: '記錄不存在' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.interviewCandidatesService.remove(id);
  }
}
