import { Module } from '@nestjs/common';
import { JudgeService } from './judge.service.js';

@Module({
  providers: [JudgeService],
  exports: [JudgeService],
})
export class JudgeModule {}
