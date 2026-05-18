import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InterviewsService } from './interviews.service.js';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@ApiTags('Interviews')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '建立面試 (輔助測試)', description: '建立一個新的面試' })
  @ApiResponse({ status: 201, description: '建立成功' })
  create(@Body() createInterviewDto: CreateInterviewDto) {
    return this.interviewsService.create(createInterviewDto);
  }

  @Get()
  @ApiOperation({ summary: '取得面試列表 (輔助測試)', description: '取得所有面試' })
  @ApiResponse({ status: 200, description: '取得成功' })
  findAll() {
    return this.interviewsService.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更改面試名稱', description: '更新面試名稱 (jobRole)' })
  @ApiResponse({ status: 200, description: '更新成功，回傳完整資料' })
  @ApiResponse({ status: 404, description: '面試不存在' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInterviewDto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(id, updateInterviewDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '刪除面試', description: '從系統中移除面試' })
  @ApiResponse({ status: 204, description: '刪除成功' })
  @ApiResponse({ status: 404, description: '面試不存在' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.interviewsService.remove(id);
  }
}
