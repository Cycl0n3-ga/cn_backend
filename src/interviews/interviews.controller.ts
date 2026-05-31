import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InterviewsService } from './interviews.service.js';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/user-role.js';

@ApiTags('Interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '建立面試 (輔助測試)',
    description: '建立一個新的面試',
  })
  @ApiResponse({ status: 201, description: '建立成功' })
  create(
    @Request() req: { user: { sub?: string; id?: string } },
    @Body() createInterviewDto: CreateInterviewDto,
  ) {
    const examinerId = String(req.user.sub || req.user.id);
    return this.interviewsService.create(examinerId, createInterviewDto);
  }

  @Get()
  @ApiOperation({
    summary: '取得面試列表 (輔助測試)',
    description: '取得所有面試',
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.interviewsService.findAll(parsedPage, parsedLimit);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '更改面試名稱',
    description: '更新面試名稱 (jobRole)',
  })
  @ApiResponse({ status: 200, description: '更新成功，回傳完整資料' })
  @ApiResponse({ status: 404, description: '面試不存在' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInterviewDto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(id, updateInterviewDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '刪除面試', description: '從系統中移除面試' })
  @ApiResponse({ status: 204, description: '刪除成功' })
  @ApiResponse({ status: 404, description: '面試不存在' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.interviewsService.remove(id);
  }
}
