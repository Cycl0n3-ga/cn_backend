import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: '取得所有使用者',
    description: '列出系統中所有使用者（不含密碼）',
  })
  @ApiResponse({ status: 200, description: '成功取得使用者列表' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':username/submissions')
  @ApiOperation({
    summary: '取得使用者提交歷史',
    description: '檢視特定使用者的歷史答題紀錄，支援分頁',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: '成功取得提交歷史' })
  @ApiResponse({ status: 404, description: '使用者不存在' })
  getSubmissions(
    @Param('username') username: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getSubmissionHistory(
      username,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
