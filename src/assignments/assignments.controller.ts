import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service.js';
import { CreateInterviewAssignmentDto } from './dto/assignment.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/user-role.js';

@ApiTags('Assignments')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER, UserRole.QUESTIONER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '指派題目給面試考生',
    description:
      '在特定面試 (jobId) 中，將題目 (problemId) 指派給考生 (userId)',
  })
  @ApiResponse({
    status: 201,
    description: '指派成功',
    schema: {
      example: {
        id: '1',
        jobId: '1',
        userId: 'uuid',
        problemId: '1',
        createdAt: '2026-05-18T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: '面試、使用者或題目不存在' })
  @ApiResponse({ status: 409, description: '此題目已指派給該考生' })
  create(@Body() dto: CreateInterviewAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '取得所有指派記錄',
    description: '列出所有面試題目指派記錄',
  })
  @ApiResponse({ status: 200, description: '成功取得清單' })
  findAll() {
    return this.assignmentsService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: '取得特定考生的指派記錄',
    description: '依使用者 ID 查詢被指派的所有題目',
  })
  @ApiResponse({ status: 200, description: '成功取得指派清單' })
  findByUser(@Param('userId') userId: string) {
    return this.assignmentsService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '取得單一指派記錄',
    description: '以指派 ID 查詢詳情',
  })
  @ApiResponse({ status: 200, description: '成功取得指派' })
  @ApiResponse({ status: 404, description: '指派不存在' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER, UserRole.QUESTIONER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '移除指派記錄',
    description: '刪除面試題目指派',
  })
  @ApiResponse({ status: 204, description: '移除成功' })
  @ApiResponse({ status: 404, description: '指派不存在' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.remove(id);
  }
}
