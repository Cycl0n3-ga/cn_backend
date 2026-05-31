import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JudgeModule } from '../judge/judge.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [PrismaModule, JudgeModule],
  controllers: [HealthController],
})
export class HealthModule {}
