import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StressTestReportsService } from './stress-test-reports.service';
import { StressTestReportsController } from './stress-test-reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [StressTestReportsController],
  providers: [StressTestReportsService],
  exports: [StressTestReportsService],
})
export class StressTestReportsModule {}
