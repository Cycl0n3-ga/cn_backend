import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionsService } from './submissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { JudgeQueueService } from '../judge/judge-queue.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let prisma: any;
  let judgeQueueService: any;

  const mockProblem = { id: 1, title: 'Two Sum', isDeleted: false };

  const mockSubmission = {
    id: 'sub-uuid-1',
    userId: 'user-uuid-1',
    problemId: 1,
    language: 'python3',
    sourceCode: 'def solve(): pass',
    status: 'PENDING',
    score: 0,
    userOutput: null,
    compileMessage: '',
    executionTimeMs: null,
    memoryUsageKb: null,
    createdAt: new Date('2026-05-13T12:00:00Z'),
    judgeJobId: null,
    queuedAt: null,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    lastError: null,
  };
  const ownerReader = { id: 'user-uuid-1', role: 'CANDIDATE' };
  const examinerReader = { id: 'examiner-uuid', role: 'EXAMINER' };

  beforeEach(async () => {
    prisma = {
      problem: {
        findFirst: jest.fn(),
      },
      submission: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      testCase: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        update: jest.fn(),
      },
      // Mock $transaction to execute the callback with the prisma mock itself
      $transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    judgeQueueService = {
      enqueueSubmission: jest.fn().mockResolvedValue({
        jobId: 'sub-uuid-1',
        driver: 'inline',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JudgeQueueService, useValue: judgeQueueService },
      ],
    }).compile();

    service = module.get<SubmissionsService>(SubmissionsService);
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create a submission and return PENDING status immediately', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.submission.create.mockResolvedValue(mockSubmission);
      prisma.submission.update.mockResolvedValue({});
      prisma.submission.count.mockResolvedValue(0);

      const result = await service.create('user-uuid-1', {
        problemId: 1,
        language: 'python3',
        sourceCode: 'def solve(): pass',
      });

      expect(result).toHaveProperty('submission_id', 'sub-uuid-1');
      expect(result).toHaveProperty('judge_job_id', 'sub-uuid-1');
      expect(result).toHaveProperty('queue_driver', 'inline');
      expect(result).toHaveProperty('status', 'PENDING');
    });

    it('should create submission with PENDING status in DB', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.submission.create.mockResolvedValue(mockSubmission);
      prisma.submission.update.mockResolvedValue({});
      prisma.submission.count.mockResolvedValue(0);

      await service.create('user-uuid-1', {
        problemId: 1,
        language: 'cpp',
        sourceCode: '#include <iostream>',
      });

      expect(prisma.submission.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            userId: 'user-uuid-1',
            problemId: 1,
            language: 'cpp',
            queuedAt: expect.any(Date),
          }),
        }),
      );
      expect(judgeQueueService.enqueueSubmission).toHaveBeenCalledWith(
        'sub-uuid-1',
      );
    });

    it('should verify problem exists before creating submission', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.submission.create.mockResolvedValue(mockSubmission);
      prisma.submission.update.mockResolvedValue({});
      prisma.submission.count.mockResolvedValue(0);

      await service.create('user-uuid-1', {
        problemId: 1,
        language: 'python3',
        sourceCode: 'pass',
      });

      expect(prisma.problem.findFirst).toHaveBeenCalledWith({
        where: { id: 1, isDeleted: false },
      });
    });

    it('should throw NotFoundException for non-existent problem', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1', {
          problemId: 999,
          language: 'python3',
          sourceCode: 'code',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with problem ID in message', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1', {
          problemId: 999,
          language: 'python3',
          sourceCode: 'code',
        }),
      ).rejects.toThrow('Problem #999 not found.');
    });

    it('should support all declared languages', async () => {
      const languages = ['javascript', 'python', 'c', 'cpp'];

      for (const lang of languages) {
        jest.clearAllMocks();
        prisma.problem.findFirst.mockResolvedValue(mockProblem);
        prisma.submission.create.mockResolvedValue({
          ...mockSubmission,
          language: lang,
        });
        prisma.submission.update.mockResolvedValue({});
        prisma.submission.count.mockResolvedValue(0);

        const result = await service.create('user-uuid-1', {
          problemId: 1,
          language: lang,
          sourceCode: 'code',
        });

        expect(result).toHaveProperty('status', 'PENDING');
      }
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return submission details for ACCEPTED submission', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'ACCEPTED',
        score: 100,
        userOutput: '[0,1]',
        executionTimeMs: 45,
        memoryUsageKb: 2048,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(result).toHaveProperty('submission_id', 'sub-uuid-1');
      expect(result).toHaveProperty('status', 'ACCEPTED');
      expect(result).toHaveProperty('score', '100');
      expect(result).toHaveProperty('user_answer', '[0,1]');
      expect(result.metrics).toHaveProperty('execution_time_ms', '45');
      expect(result.metrics).toHaveProperty('memory_usage_kb', '2048');
    });

    it('should return all required fields with correct snake_case naming', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'ACCEPTED',
        score: 100,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(result).toHaveProperty('submission_id');
      expect(result).toHaveProperty('problem_id');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('user_answer');
      expect(result).toHaveProperty('compile_message');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('submitted_at');
    });

    it('should return numeric values as strings (per API contract)', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'ACCEPTED',
        score: 100,
        executionTimeMs: 45,
        memoryUsageKb: 2048,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(typeof result.problem_id).toBe('string');
      expect(typeof result.score).toBe('string');
      expect(typeof result.metrics.execution_time_ms).toBe('string');
      expect(typeof result.metrics.memory_usage_kb).toBe('string');
    });

    it('should return default metrics 0 when null in DB', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'PENDING',
        executionTimeMs: null,
        memoryUsageKb: null,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(result.metrics.execution_time_ms).toBe('0');
      expect(result.metrics.memory_usage_kb).toBe('0');
    });

    it('should return empty string for user_answer when userOutput is null', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        userOutput: null,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(result.user_answer).toBe('');
    });

    it('should return PENDING status correctly', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'PENDING',
        score: 0,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(result.status).toBe('PENDING');
    });

    it('should return WRONG_ANSWER status correctly', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'WRONG_ANSWER',
        score: 0,
      });

      const result = await service.findOne('sub-uuid-1', ownerReader);

      expect(result.status).toBe('WRONG_ANSWER');
    });

    it('should allow EXAMINER to read any submission', async () => {
      prisma.submission.findUnique.mockResolvedValue(mockSubmission);

      const result = await service.findOne('sub-uuid-1', examinerReader);

      expect(result.submission_id).toBe('sub-uuid-1');
    });

    it('should throw ForbiddenException when another candidate reads the submission', async () => {
      prisma.submission.findUnique.mockResolvedValue(mockSubmission);

      await expect(
        service.findOne('sub-uuid-1', {
          id: 'other-candidate-uuid',
          role: 'CANDIDATE',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent submission', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', ownerReader),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with submission ID in message', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id', ownerReader)).rejects.toThrow(
        'Submission "bad-id" not found.',
      );
    });
  });
});
