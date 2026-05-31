import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { UserRole } from '../auth/user-role.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EXAMINER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '取得所有使用者',
    description:
      '列出系統中所有使用者（不含密碼）。需要 ADMIN 或 EXAMINER 權限。',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: '成功取得使用者列表' })
  @ApiResponse({ status: 401, description: '未認證' })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit || '20', 10) || 20),
    );
    return this.usersService.findAll(parsedPage, parsedLimit);
  }

  @Get(':username/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '取得使用者提交歷史',
    description: '檢視特定使用者的歷史答題紀錄。使用者僅可查看自己的提交歷史。',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: '成功取得提交歷史' })
  @ApiResponse({ status: 401, description: '未認證' })
  @ApiResponse({ status: 403, description: '無權限' })
  @ApiResponse({ status: 404, description: '使用者不存在' })
  getSubmissions(
    @Request() req: { user: { username: string; role: string } },
    @Param('username') username: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Only allow users to view their own submissions, or ADMIN/EXAMINER to view any
    const isOwner = req.user.username === username;
    const isPrivileged = ['ADMIN', 'EXAMINER'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenException(
        'You can only view your own submission history.',
      );
    }

    const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit || '20', 10) || 20),
    );
    return this.usersService.getSubmissionHistory(
      username,
      parsedPage,
      parsedLimit,
    );
  }
}
