import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service.js';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({
    summary: '全站排行榜',
    description: '依照 rating 與解題數排序的使用者排行榜，支援分頁',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: '成功取得排行榜',
    schema: {
      example: {
        total: '100',
        page: '1',
        data: [
          { rank: '1', username: 'bob', solved_count: '5', rating: '1800' },
          { rank: '2', username: 'alice', solved_count: '3', rating: '1500' },
        ],
      },
    },
  })
  getRankings(@Query('page') page?: string, @Query('limit') limit?: string) {
    const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit || '20', 10) || 20),
    );
    return this.leaderboardService.getRankings(parsedPage, parsedLimit);
  }
}
