import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('System')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: '系統健康檢查',
    description: '確認系統與資料庫是否正常運作',
  })
  @ApiResponse({
    status: 200,
    description: '系統狀態',
    schema: {
      example: {
        status: 'UP',
        services: { database: 'OK', judge_queue: 'OK' },
        queue_depth: '0',
        uptime: '3600s',
        timestamp: '2026-05-09T15:30:00.000Z',
      },
    },
  })
  async check() {
    let dbStatus = 'OK';
    try {
      await this.prisma.user.count();
    } catch {
      dbStatus = 'DOWN';
    }

    const pendingSubmissions = await this.prisma.submission.count({
      where: { status: { in: ['PENDING', 'COMPILING', 'RUNNING'] } },
    });

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: dbStatus === 'OK' ? 'UP' : 'DOWN',
      services: {
        database: dbStatus,
        judge_queue: 'OK', // Mock — always OK in dev
      },
      queue_depth: pendingSubmissions.toString(),
      uptime: `${uptimeSeconds}s`,
      timestamp: new Date().toISOString(),
    };
  }
}
