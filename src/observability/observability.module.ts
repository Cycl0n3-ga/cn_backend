import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JudgeModule } from '../judge/judge.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsModule } from './metrics.module.js';

@Module({
  imports: [PrismaModule, JudgeModule, MetricsModule],
  controllers: [MetricsController],
  exports: [MetricsModule],
})
export class ObservabilityModule {}
