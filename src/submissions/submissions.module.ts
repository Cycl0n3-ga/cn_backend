import { Module } from '@nestjs/common';
import { JudgeModule } from 'src/judge/judge.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [PrismaModule, JudgeModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
