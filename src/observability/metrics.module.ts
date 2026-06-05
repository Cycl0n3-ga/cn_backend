import { Module } from '@nestjs/common';
import { defaultMetricsService, MetricsService } from './metrics.service.js';

@Module({
  providers: [{ provide: MetricsService, useValue: defaultMetricsService }],
  exports: [MetricsService],
})
export class MetricsModule {}
