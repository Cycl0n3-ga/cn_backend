import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProblemsController } from './problems.controller.js';
import { ProblemsService } from './problems.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
