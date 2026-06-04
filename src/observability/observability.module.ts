import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JudgeModule } from '../judge/judge.module.js';
import { MetricsController } from './metrics.controller.js';
import { defaultMetricsService, MetricsService } from './metrics.service.js';

@Module({
  imports: [PrismaModule, JudgeModule],
  controllers: [MetricsController],
  providers: [{ provide: MetricsService, useValue: defaultMetricsService }],
  exports: [MetricsService],
})
export class ObservabilityModule {}
