import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StressTestReportsService } from './stress-test-reports.service.js';
import { StressTestReportsController } from './stress-test-reports.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [StressTestReportsController],
  providers: [StressTestReportsService],
  exports: [StressTestReportsService],
})
export class StressTestReportsModule {}
