import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProblemsService } from './problems.service.js';
import { CreateProblemDto, AssignProblemDto } from './dto/index.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@ApiTags('Problems')
@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get()
  @ApiOperation({
    summary: '取得題目清單',
    description: '列出所有公開題目，支援分頁與難度篩選',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    enum: ['EASY', 'MEDIUM', 'HARD'],
  })
  @ApiResponse({ status: 200, description: '成功取得題目列表' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    return this.problemsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      difficulty,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: '取得題目詳情',
    description: '取得單一題目完整描述，不含隱藏測資',
  })
  @ApiResponse({ status: 200, description: '成功取得題目詳情' })
  @ApiResponse({ status: 404, description: '題目不存在' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.problemsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '新增題目 (Admin)',
    description: '管理員新增題目，包含測試資料',
  })
  @ApiResponse({ status: 201, description: '題目建立成功' })
  @ApiResponse({ status: 401, description: '未認證' })
  @ApiResponse({ status: 403, description: '權限不足' })
  create(@Body() dto: CreateProblemDto) {
    return this.problemsService.create({
      title: dto.title,
      description: dto.description,
      difficulty: dto.difficulty,
      functionName: dto.function_name,
      timeLimitMs: dto.time_limit_ms,
      memoryLimitMb: dto.memory_limit_mb,
      testCases: dto.test_cases.map((tc) => ({
        input: tc.input,
        output: tc.output,
        isHidden: tc.is_hidden ?? true,
      })),
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '刪除題目 (Admin)', description: '軟刪除指定題目' })
  @ApiResponse({ status: 204, description: '刪除成功' })
  @ApiResponse({ status: 404, description: '題目不存在' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.problemsService.remove(id);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '指派題目 (Admin)',
    description: '將題目指定給特定使用者',
  })
  @ApiResponse({ status: 200, description: '指派成功' })
  @ApiResponse({ status: 404, description: '題目或使用者不存在' })
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignProblemDto) {
    return this.problemsService.assign(id, dto.assignee_username);
  }
}
