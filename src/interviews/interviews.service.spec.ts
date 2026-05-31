import { Test, TestingModule } from '@nestjs/testing';
import { InterviewsService } from './interviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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
  const mockExaminer = {
    id: 'user-uuid-1',
    username: 'examiner',
    role: 'EXAMINER',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      interview: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      interviewCandidate: {
        create: jest.fn(),
      },
      interviewAssignment: {
        create: jest.fn(),
      },
      problem: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
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
      prisma.user.findUnique.mockResolvedValue(mockExaminer);
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
      prisma.user.findUnique.mockResolvedValue(mockExaminer);
      prisma.interview.create.mockResolvedValue(mockInterview);

      const result = await service.create({
        jobRole: 'Test',
        examinerEmpId: 'uid',
      });

      expect(typeof result.id).toBe('string');
    });

    it('should pass correct data to prisma', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockExaminer,
        id: 'examiner-uuid',
      });
      prisma.interview.create.mockResolvedValue(mockInterview);

      await service.create({
        jobRole: 'Frontend Dev',
        examinerEmpId: 'examiner-uuid',
      });

      expect(prisma.interview.create).toHaveBeenCalledWith({
        data: { jobRole: 'Frontend Dev', examinerEmpId: 'examiner-uuid' },
      });
    });

    it('should create an interview candidate and assign problems by difficulty counts', async () => {
      const createdAt = new Date('2026-05-31T00:00:00.000Z');
      const easyProblem1 = { id: 10, title: 'Two Sum', difficulty: 'EASY' };
      const easyProblem2 = {
        id: 11,
        title: 'Reverse String',
        difficulty: 'EASY',
      };
      const mediumProblem = {
        id: 20,
        title: 'Maximum Subarray',
        difficulty: 'MEDIUM',
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'candidate-uuid',
        username: 'alice',
      });
      prisma.problem.findMany
        .mockResolvedValueOnce([easyProblem1, easyProblem2])
        .mockResolvedValueOnce([mediumProblem]);
      prisma.interview.create.mockResolvedValue(mockInterview);
      prisma.interviewCandidate.create.mockResolvedValue({
        id: 7,
        jobId: 1,
        userId: 'candidate-uuid',
      });
      prisma.interviewAssignment.create
        .mockResolvedValueOnce({
          id: 100,
          jobId: 1,
          userId: 'candidate-uuid',
          problemId: 10,
          createdAt,
          problem: easyProblem1,
        })
        .mockResolvedValueOnce({
          id: 101,
          jobId: 1,
          userId: 'candidate-uuid',
          problemId: 11,
          createdAt,
          problem: easyProblem2,
        })
        .mockResolvedValueOnce({
          id: 102,
          jobId: 1,
          userId: 'candidate-uuid',
          problemId: 20,
          createdAt,
          problem: mediumProblem,
        });

      const result = await service.create({
        jobRole: 'Backend Developer',
        examinerEmpId: 'user-uuid-1',
        candidateUserId: 'candidate-uuid',
        problemCounts: { easy: 2, medium: 1, hard: 0 },
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'candidate-uuid' },
      });
      expect(prisma.problem.findMany).toHaveBeenNthCalledWith(1, {
        where: { difficulty: 'EASY', isDeleted: false },
        select: { id: true, title: true, difficulty: true },
        orderBy: { id: 'asc' },
        take: 2,
      });
      expect(prisma.problem.findMany).toHaveBeenNthCalledWith(2, {
        where: { difficulty: 'MEDIUM', isDeleted: false },
        select: { id: true, title: true, difficulty: true },
        orderBy: { id: 'asc' },
        take: 1,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.interviewCandidate.create).toHaveBeenCalledWith({
        data: { jobId: 1, userId: 'candidate-uuid' },
      });
      expect(prisma.interviewAssignment.create).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({
        id: '1',
        candidate: { id: '7', jobId: '1', userId: 'candidate-uuid' },
        problemCounts: { easy: 2, medium: 1, hard: 0 },
        assignments: [
          { id: '100', problemId: '10', problem: easyProblem1 },
          { id: '101', problemId: '11', problem: easyProblem2 },
          { id: '102', problemId: '20', problem: mediumProblem },
        ],
      });
    });

    it('should create a candidate without assignments when candidateUserId has no counts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'candidate-uuid',
        username: 'alice',
      });
      prisma.interview.create.mockResolvedValue(mockInterview);
      prisma.interviewCandidate.create.mockResolvedValue({
        id: 7,
        jobId: 1,
        userId: 'candidate-uuid',
      });

      const result = await service.create({
        jobRole: 'Backend Developer',
        examinerEmpId: 'user-uuid-1',
        candidateUserId: 'candidate-uuid',
      });

      expect(prisma.problem.findMany).not.toHaveBeenCalled();
      expect(prisma.interviewAssignment.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        id: '1',
        candidate: { id: '7', jobId: '1', userId: 'candidate-uuid' },
        problemCounts: { easy: 0, medium: 0, hard: 0 },
        assignments: [],
      });
    });

    it('should throw BadRequestException when problem counts are provided without candidateUserId', async () => {
      await expect(
        service.create({
          jobRole: 'Backend Developer',
          examinerEmpId: 'user-uuid-1',
          problemCounts: { easy: 1, medium: 0, hard: 0 },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.interview.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when candidate user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          jobRole: 'Backend Developer',
          examinerEmpId: 'user-uuid-1',
          candidateUserId: 'missing-user',
          problemCounts: { easy: 1, medium: 0, hard: 0 },
        }),
      ).rejects.toThrow('User #missing-user not found.');

      expect(prisma.problem.findMany).not.toHaveBeenCalled();
      expect(prisma.interview.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when there are not enough problems for a requested difficulty', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'candidate-uuid',
        username: 'alice',
      });
      prisma.problem.findMany.mockResolvedValueOnce([
        { id: 10, title: 'Two Sum', difficulty: 'EASY' },
      ]);

      await expect(
        service.create({
          jobRole: 'Backend Developer',
          examinerEmpId: 'user-uuid-1',
          candidateUserId: 'candidate-uuid',
          problemCounts: { easy: 2, medium: 0, hard: 0 },
        }),
      ).rejects.toThrow('Not enough EASY problems. Requested 2, available 1.');

      expect(prisma.interview.create).not.toHaveBeenCalled();
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

      const result = await service.update(1, {
        jobRole: 'Senior Backend Developer',
      });

      expect(result).toHaveProperty('jobRole', 'Senior Backend Developer');
      expect(result).toHaveProperty('id', '1');
    });

    it('should throw NotFoundException for non-existent interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { jobRole: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
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
      expect(prisma.interview.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException for non-existent interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
