import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeQueueService } from '../judge/judge-queue.service.js';
import { MetricsService } from './metrics.service.js';

@ApiTags('Observability')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({
    summary: 'Prometheus metrics',
    description:
      'Exports HTTP, process, database, submission and judge queue metrics in Prometheus text format.',
  })
  async scrape(@Res({ passthrough: true }) response: Response) {
    await this.refreshRuntimeMetrics();
    response.type(this.metrics.contentType);
    return this.metrics.metrics();
  }

  private async refreshRuntimeMetrics() {
    await Promise.all([
      this.refreshDatabaseMetrics(),
      this.refreshQueueMetrics(),
      this.refreshSubmissionMetrics(),
    ]);
  }

  private async refreshDatabaseMetrics() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.metrics.setDatabaseHealth({
        up: true,
        latencyMs: Date.now() - startedAt,
      });
    } catch {
      this.metrics.setDatabaseHealth({
        up: false,
        latencyMs: Date.now() - startedAt,
      });
    }
  }

  private async refreshQueueMetrics() {
    try {
      const stats = await this.judgeQueueService.getStats();
      this.metrics.setQueueStats(stats);
    } catch {
      // Readiness reports dependency health; metrics scraping should remain best-effort.
    }
  }

  private async refreshSubmissionMetrics() {
    try {
      const statusGroups = await this.prisma.submission.groupBy({
        by: ['status'],
        _count: true,
      });
      const counts = statusGroups.reduce(
        (acc, group) => {
          acc[group.status] = group._count;
          return acc;
        },
        {} as Record<string, number>,
      );
      this.metrics.setSubmissionStatusCounts(counts);
    } catch {
      this.metrics.setSubmissionStatusCounts({});
    }
  }
}
