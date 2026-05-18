import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InterviewCandidatesService } from './interview-candidates.service.js';
import { InterviewCandidatesController } from './interview-candidates.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [InterviewCandidatesController],
  providers: [InterviewCandidatesService],
})
export class InterviewCandidatesModule {}
