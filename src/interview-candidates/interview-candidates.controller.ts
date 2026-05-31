import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InterviewCandidatesService } from './interview-candidates.service.js';
import {
  CreateInterviewCandidateDto,
  UpdateInterviewCandidateTimeDto,
} from './dto/interview-candidate.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/user-role.js';

@ApiTags('Interview Candidates')
@Controller('interview-candidates')
export class InterviewCandidatesController {
  constructor(
    private readonly interviewCandidatesService: InterviewCandidatesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '新增面試者到面試',
    description: '將使用者加入指定的面試中',
  })
  @ApiResponse({
    status: 201,
    description:
      '新增成功，回傳包含 id、jobId、userId、startTime、endTime 的資料',
    schema: {
      example: {
        id: '1',
        jobId: '1',
        userId: 'uuid-string',
        startTime: 1770000000,
        endTime: 1770003600,
      },
    },
  })
  @ApiResponse({ status: 400, description: '時間格式或區間不合法' })
  @ApiResponse({ status: 404, description: '面試或使用者不存在' })
  @ApiResponse({ status: 409, description: '使用者已在此面試中' })
  create(@Body() createInterviewCandidateDto: CreateInterviewCandidateDto) {
    return this.interviewCandidatesService.create(createInterviewCandidateDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '取得所有面試考生列表',
    description: '列出所有面試中的考生記錄（含面試及使用者資訊）。需要 EXAMINER 權限。',
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
          startTime: 1770000000,
          endTime: 1770003600,
          createdAt: '2026-05-18T00:00:00Z',
          interview: {
            id: '1',
            jobRole: 'Backend Developer',
            examinerEmpId: 'uuid',
          },
          user: {
            id: 'uuid-string',
            username: 'alice',
            role: 'CANDIDATE',
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: '未認證' })
  @ApiResponse({ status: 403, description: '權限不足' })
  findAll() {
    return this.interviewCandidatesService.findAll();
  }

  @Get(':id/time-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER, UserRole.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '取得面試考生測驗剩餘時間',
    description:
      '以伺服器 Unix timestamp seconds 計算測驗狀態與剩餘秒數，避免依賴前端時間',
  })
  @ApiResponse({
    status: 200,
    description: '成功取得時間狀態',
    schema: {
      example: {
        id: '1',
        jobId: '1',
        userId: 'uuid-string',
        serverTime: 1770000300,
        startTime: 1770000000,
        endTime: 1770003600,
        remainingTime: 3300,
        elapsedTime: 300,
        duration: 3600,
        timeUntilStart: 0,
        status: 'IN_PROGRESS',
      },
    },
  })
  @ApiResponse({ status: 401, description: '未認證' })
  @ApiResponse({ status: 403, description: '權限不足' })
  @ApiResponse({ status: 404, description: '記錄不存在' })
  getTimeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: string; role: string } },
  ) {
    return this.interviewCandidatesService.getTimeStatus(id, req.user);
  }

  @Patch(':id/time')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '更新面試考生測驗時間',
    description:
      '更新指定面試考生的測驗開始與結束時間，startTime/endTime 使用 Unix timestamp seconds',
  })
  @ApiResponse({
    status: 200,
    description: '更新成功',
    schema: {
      example: {
        id: '1',
        jobId: '1',
        userId: 'uuid-string',
        startTime: 1770000000,
        endTime: 1770003600,
      },
    },
  })
  @ApiResponse({ status: 400, description: '時間格式或區間不合法' })
  @ApiResponse({ status: 404, description: '記錄不存在' })
  updateTime(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInterviewCandidateTimeDto,
  ) {
    return this.interviewCandidatesService.updateTime(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
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
