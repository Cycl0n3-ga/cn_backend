import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JudgeController } from './judge.controller.js';
import { JudgeQueueService } from './judge-queue.service.js';
import { JudgeService } from './judge.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [JudgeController],
  providers: [JudgeService, JudgeQueueService],
  exports: [JudgeService, JudgeQueueService],
})
export class JudgeModule {}
