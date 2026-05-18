import { Test, TestingModule } from '@nestjs/testing';
import { InterviewsService } from './interviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('InterviewsService', () => {
  let service: InterviewsService;
  let prisma: any;

  const mockInterview = {
    id: 1,
    jobRole: 'Backend Developer',
    examinerEmpId: 'user-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      interview: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InterviewsService>(InterviewsService);
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create an interview and return id, jobRole, examinerEmpId', async () => {
      prisma.interview.create.mockResolvedValue(mockInterview);

      const result = await service.create({
        jobRole: 'Backend Developer',
        examinerEmpId: 'user-uuid-1',
      });

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('jobRole', 'Backend Developer');
      expect(result).toHaveProperty('examinerEmpId', 'user-uuid-1');
    });

    it('should return id as string', async () => {
      prisma.interview.create.mockResolvedValue(mockInterview);

      const result = await service.create({ jobRole: 'Test', examinerEmpId: 'uid' });

      expect(typeof result.id).toBe('string');
    });

    it('should pass correct data to prisma', async () => {
      prisma.interview.create.mockResolvedValue(mockInterview);

      await service.create({ jobRole: 'Frontend Dev', examinerEmpId: 'examiner-uuid' });

      expect(prisma.interview.create).toHaveBeenCalledWith({
        data: { jobRole: 'Frontend Dev', examinerEmpId: 'examiner-uuid' },
      });
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all interviews', async () => {
      prisma.interview.findMany.mockResolvedValue([mockInterview]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', '1');
      expect(result[0]).toHaveProperty('jobRole', 'Backend Developer');
    });

    it('should return empty array when no interviews', async () => {
      prisma.interview.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });

    it('should return IDs as strings', async () => {
      prisma.interview.findMany.mockResolvedValue([mockInterview]);

      const result = await service.findAll();

      expect(typeof result[0].id).toBe('string');
    });
  });

  // ── update ────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update and return updated interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.interview.update.mockResolvedValue({
        ...mockInterview,
        jobRole: 'Senior Backend Developer',
      });

      const result = await service.update(1, { jobRole: 'Senior Backend Developer' });

      expect(result).toHaveProperty('jobRole', 'Senior Backend Developer');
      expect(result).toHaveProperty('id', '1');
    });

    it('should throw NotFoundException for non-existent interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { jobRole: 'Test' })).rejects.toThrow(NotFoundException);
    });

    it('should throw with correct message', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.update(5, { jobRole: 'Test' })).rejects.toThrow(
        'Interview #5 not found.',
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete an existing interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.interview.delete.mockResolvedValue(mockInterview);

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(prisma.interview.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException for non-existent interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
