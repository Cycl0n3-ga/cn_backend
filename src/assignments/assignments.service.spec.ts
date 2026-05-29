import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsService } from './assignments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let prisma: any;

  const mockInterview = {
    id: 1,
    jobRole: 'Backend Developer',
    examinerEmpId: 'examiner-uuid',
  };
  const mockUser = {
    id: 'user-uuid-1',
    username: 'alice',
    email: 'alice@example.com',
  };
  const mockProblem = {
    id: 1,
    title: 'Two Sum',
    difficulty: 'EASY',
    isDeleted: false,
  };

  const mockAssignment = {
    id: 1,
    jobId: 1,
    userId: 'user-uuid-1',
    problemId: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    interview: mockInterview,
    problem: { id: 1, title: 'Two Sum', difficulty: 'EASY' },
    user: { id: 'user-uuid-1', username: 'alice', email: 'alice@example.com' },
  };

  beforeEach(async () => {
    prisma = {
      interview: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      problem: { findFirst: jest.fn() },
      interviewAssignment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create an assignment and return formatted result', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.interviewAssignment.create.mockResolvedValue(mockAssignment);

      const result = await service.create({
        jobId: 1,
        userId: 'user-uuid-1',
        problemId: 1,
      });

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('jobId', '1');
      expect(result).toHaveProperty('userId', 'user-uuid-1');
      expect(result).toHaveProperty('problemId', '1');
      expect(result).toHaveProperty('interview');
      expect(result).toHaveProperty('problem');
      expect(result).toHaveProperty('user');
    });

    it('should return id, jobId, problemId as strings (API contract)', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.interviewAssignment.create.mockResolvedValue(mockAssignment);

      const result = await service.create({
        jobId: 1,
        userId: 'user-uuid-1',
        problemId: 1,
      });

      expect(typeof result.id).toBe('string');
      expect(typeof result.jobId).toBe('string');
      expect(typeof result.problemId).toBe('string');
    });

    it('should throw NotFoundException when interview does not exist', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 999, userId: 'user-uuid-1', problemId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with interview ID in message', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 42, userId: 'user-uuid-1', problemId: 1 }),
      ).rejects.toThrow('Interview #42 not found.');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 1, userId: 'nonexistent-user', problemId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when problem does not exist', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 1, userId: 'user-uuid-1', problemId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with problem ID in message', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ jobId: 1, userId: 'user-uuid-1', problemId: 77 }),
      ).rejects.toThrow('Problem #77 not found.');
    });

    it('should throw ConflictException on duplicate assignment (P2002)', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.problem.findFirst.mockResolvedValue(mockProblem);

      const uniqueError = new Error('Unique constraint failed');
      (uniqueError as any).code = 'P2002';
      prisma.interviewAssignment.create.mockRejectedValue(uniqueError);

      await expect(
        service.create({ jobId: 1, userId: 'user-uuid-1', problemId: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should re-throw unknown database errors', async () => {
      prisma.interview.findUnique.mockResolvedValue(mockInterview);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.interviewAssignment.create.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        service.create({ jobId: 1, userId: 'user-uuid-1', problemId: 1 }),
      ).rejects.toThrow('DB connection lost');
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all assignments formatted', async () => {
      prisma.interviewAssignment.findMany.mockResolvedValue([mockAssignment]);

      const result = await service.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', '1');
    });

    it('should return an empty array when no assignments exist', async () => {
      prisma.interviewAssignment.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should return all assignments with correct fields', async () => {
      prisma.interviewAssignment.findMany.mockResolvedValue([
        mockAssignment,
        mockAssignment,
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      for (const item of result) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('jobId');
        expect(item).toHaveProperty('userId');
        expect(item).toHaveProperty('problemId');
        expect(item).toHaveProperty('createdAt');
      }
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return a single assignment by ID', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(mockAssignment);

      const result = await service.findOne(1);

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('jobId', '1');
    });

    it('should throw NotFoundException for non-existent assignment', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with assignment ID in message', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(42)).rejects.toThrow(
        'Assignment #42 not found.',
      );
    });
  });

  // ── findByUser ─────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('should return all assignments for a specific user', async () => {
      prisma.interviewAssignment.findMany.mockResolvedValue([mockAssignment]);

      const result = await service.findByUser('user-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-uuid-1');
    });

    it('should return empty array when user has no assignments', async () => {
      prisma.interviewAssignment.findMany.mockResolvedValue([]);

      const result = await service.findByUser('user-uuid-no-assignments');

      expect(result).toEqual([]);
    });

    it('should query with correct userId filter', async () => {
      prisma.interviewAssignment.findMany.mockResolvedValue([]);

      await service.findByUser('specific-user-id');

      expect(prisma.interviewAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'specific-user-id' },
        }),
      );
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete an assignment successfully', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(mockAssignment);
      prisma.interviewAssignment.delete.mockResolvedValue(mockAssignment);

      await expect(service.remove(1)).resolves.not.toThrow();
      expect(prisma.interviewAssignment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(null);

      await expect(service.remove(55)).rejects.toThrow(
        'Assignment #55 not found.',
      );
    });

    it('should not call delete when assignment not found', async () => {
      prisma.interviewAssignment.findUnique.mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
      expect(prisma.interviewAssignment.delete).not.toHaveBeenCalled();
    });
  });
});
