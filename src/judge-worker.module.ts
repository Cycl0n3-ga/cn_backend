import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { JudgeModule } from './judge/judge.module.js';
import { JudgeWorkerService } from './judge/judge-worker.service.js';

@Module({
  imports: [PrismaModule, JudgeModule],
  providers: [JudgeWorkerService],
})
export class JudgeWorkerModule {}
