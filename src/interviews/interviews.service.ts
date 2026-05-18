import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInterviewDto, UpdateInterviewDto } from './dto/interview.dto.js';

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createInterviewDto: CreateInterviewDto) {
    const interview = await this.prisma.interview.create({
      data: {
        jobRole: createInterviewDto.jobRole,
        examinerEmpId: createInterviewDto.examinerEmpId,
      },
    });

    return {
      id: interview.id.toString(),
      jobRole: interview.jobRole,
      examinerEmpId: interview.examinerEmpId,
    };
  }

  async findAll() {
    const interviews = await this.prisma.interview.findMany();
    return interviews.map((i) => ({
      id: i.id.toString(),
      jobRole: i.jobRole,
      examinerEmpId: i.examinerEmpId,
    }));
  }

  async update(id: number, updateInterviewDto: UpdateInterviewDto) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) {
      throw new NotFoundException(`Interview #${id} not found.`);
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: { jobRole: updateInterviewDto.jobRole },
    });

    return {
      id: updated.id.toString(),
      jobRole: updated.jobRole,
      examinerEmpId: updated.examinerEmpId,
    };
  }

  async remove(id: number) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) {
      throw new NotFoundException(`Interview #${id} not found.`);
    }

    await this.prisma.interview.delete({ where: { id } });
    return;
  }
}
