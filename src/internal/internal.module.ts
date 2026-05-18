import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { InternalController } from './internal.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [InternalController],
})
export class InternalModule {}
