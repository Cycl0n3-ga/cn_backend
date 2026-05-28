import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JudgeController } from './judge.controller';
import { JudgeQueueService } from './judge-queue.service';
import { JudgeService } from './judge.service';

@Module({
  imports: [PrismaModule],
  controllers: [JudgeController],
  providers: [JudgeService, JudgeQueueService],
  exports: [JudgeService, JudgeQueueService],
})
export class JudgeModule {}
