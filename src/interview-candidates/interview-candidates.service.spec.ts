import { Test, TestingModule } from '@nestjs/testing';
import { InterviewCandidatesService } from './interview-candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('InterviewCandidatesService', () => {
  let service: InterviewCandidatesService;
  let prisma: any;

  const mockInterview = {
    id: 1,
    jobRole: 'Backend Developer',
    examinerEmpId: 'examiner-uuid',
  };
  const mockUser = { id: 'user-uuid-1', username: 'alice' };
  const mockCandidate = {
    id: 1,
    jobId: 1,
    userId: 'user-uuid-1',
    startTime: null,
    endTime: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      interview: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      interviewCandidate: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewCandidatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InterviewCandidatesService>(
      InterviewCandidatesService,
    );
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should add a candidate to an interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.interviewCandidate.create.mockResolvedValue(mockCandidate);

      const result = await service.create({ jobId: 1, userId: 'user-uuid-1' });

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('jobId', '1');
      expect(result).toHaveProperty('userId', 'user-uuid-1');
      expect(result).toHaveProperty('startTime', null);
      expect(result).toHaveProperty('endTime', null);
    });

    it('should return id and jobId as strings', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.interviewCandidate.create.mockResolvedValue(mockCandidate);

      const result = await service.create({ jobId: 1, userId: 'user-uuid-1' });

      expect(typeof result.id).toBe('string');
      expect(typeof result.jobId).toBe('string');
    });

    it('should store optional Unix start and end times', async () => {
      const timedCandidate = {
        ...mockCandidate,
        startTime: 1770000000,
        endTime: 1770003600,
      };
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.interviewCandidate.create.mockResolvedValue(timedCandidate);

      const result = await service.create({
        jobId: 1,
        userId: 'user-uuid-1',
        startTime: 1770000000,
        endTime: 1770003600,
      });

      expect(prisma.interviewCandidate.create).toHaveBeenCalledWith({
        data: {
          jobId: 1,
          userId: 'user-uuid-1',
          startTime: 1770000000,
          endTime: 1770003600,
        },
      });
      expect(result).toHaveProperty('startTime', 1770000000);
      expect(result).toHaveProperty('endTime', 1770003600);
    });

    it('should throw BadRequestException when endTime is before startTime', async () => {
      await expect(
        service.create({
          jobId: 1,
          userId: 'user-uuid-1',
          startTime: 1770003600,
          endTime: 1770000000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when interview does not exist', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 999, userId: 'user-uuid-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 1, userId: 'nonexistent-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when candidate already added (P2002)', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const uniqueError = new Error('Unique constraint failed');
      (uniqueError as any).code = 'P2002';
      prisma.interviewCandidate.create.mockRejectedValue(uniqueError);

      await expect(
        service.create({ jobId: 1, userId: 'user-uuid-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should re-throw unknown errors', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const unknownError = new Error('Unknown DB error');
      prisma.interviewCandidate.create.mockRejectedValue(unknownError);

      await expect(
        service.create({ jobId: 1, userId: 'user-uuid-1' }),
      ).rejects.toThrow('Unknown DB error');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all candidates formatted', async () => {
      const mockDbCandidate = {
        id: 1,
        jobId: 1,
        userId: 'user-uuid-1',
        startTime: 1770000000,
        endTime: 1770003600,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        interview: {
          id: 1,
          jobRole: 'Backend Developer',
          examinerEmpId: 'examiner-uuid',
        },
        user: {
          id: 'user-uuid-1',
          username: 'alice',
          email: 'alice@example.com',
        },
      };

      prisma.interviewCandidate.findMany.mockResolvedValue([mockDbCandidate]);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', '1');
      expect(result[0]).toHaveProperty('jobId', '1');
      expect(result[0]).toHaveProperty('startTime', 1770000000);
      expect(result[0]).toHaveProperty('endTime', 1770003600);
      expect(result[0]).toHaveProperty('interview');
      expect(result[0]).toHaveProperty('user');
    });

    it('should return empty array when no candidates exist', async () => {
      prisma.interviewCandidate.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ── updateTime ───────────────────────────────────────────────────────
  describe('updateTime', () => {
    it('should update candidate Unix start and end times', async () => {
      const updatedCandidate = {
        ...mockCandidate,
        startTime: 1770000000,
        endTime: 1770003600,
      };
      prisma.interviewCandidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.interviewCandidate.update.mockResolvedValue(updatedCandidate);

      const result = await service.updateTime(1, {
        startTime: 1770000000,
        endTime: 1770003600,
      });

      expect(prisma.interviewCandidate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { startTime: 1770000000, endTime: 1770003600 },
      });
      expect(result).toEqual({
        id: '1',
        jobId: '1',
        userId: 'user-uuid-1',
        startTime: 1770000000,
        endTime: 1770003600,
      });
    });

    it('should clear candidate times when null is provided', async () => {
      const timedCandidate = {
        ...mockCandidate,
        startTime: 1770000000,
        endTime: 1770003600,
      };
      prisma.interviewCandidate.findUnique.mockResolvedValue(timedCandidate);
      prisma.interviewCandidate.update.mockResolvedValue(mockCandidate);

      const result = await service.updateTime(1, {
        startTime: null,
        endTime: null,
      });

      expect(prisma.interviewCandidate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { startTime: null, endTime: null },
      });
      expect(result.startTime).toBeNull();
      expect(result.endTime).toBeNull();
    });

    it('should throw NotFoundException when candidate does not exist', async () => {
      prisma.interviewCandidate.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTime(999, { startTime: 1770000000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updated endTime is before startTime', async () => {
      prisma.interviewCandidate.findUnique.mockResolvedValue({
        ...mockCandidate,
        startTime: 1770003600,
      });

      await expect(
        service.updateTime(1, { endTime: 1770000000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete a candidate record', async () => {
      prisma.interviewCandidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.interviewCandidate.delete.mockResolvedValue(mockCandidate);

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(prisma.interviewCandidate.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException for non-existent candidate', async () => {
      prisma.interviewCandidate.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message', async () => {
      prisma.interviewCandidate.findUnique.mockResolvedValue(null);

      await expect(service.remove(42)).rejects.toThrow(
        'InterviewCandidate #42 not found.',
      );
    });
  });
});
