import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionsService } from './submissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { JudgeQueueService } from '../judge/judge-queue.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let prisma: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JudgeQueueService, useValue: { enqueue: jest.fn() } },
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
          }),
        }),
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

  // ── runJudgeForSubmission (integration via mock JudgeService) ─────────────
  describe('runJudgeForSubmission (mock worker)', () => {
    let judgeService: any;

    beforeEach(() => {
      // Get the mocked JudgeService instance from the testing module
      judgeService = service['judgeQueueService'];

      prisma.submission.update.mockResolvedValue({});
      prisma.testCase.findMany.mockResolvedValue([
        { input: '1', output: 'OK' },
      ]);
      prisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        id: 'sub-uuid-1',
        userId: 'user-uuid-1',
        problemId: 1,
      });
      prisma.submission.count.mockResolvedValue(0);
      prisma.user.update.mockResolvedValue({});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should process statuses and finalize as ACCEPTED, then update user stats on first AC', async () => {
      judgeService.enqueue.mockResolvedValue({
        status: 'ACCEPTED',
        executionTimeMs: 10,
        stdout: 'OK',
        stderr: '',
        score: 100,
      });

      await (service as any).runJudgeForSubmission({
        submissionId: 'sub-uuid-1',
        problemId: 1,
        userId: 'user-uuid-1',
        language: 'javascript',
        sourceCode: 'console.log("OK")',
      });

      expect(prisma.submission.update).toHaveBeenLastCalledWith({
        where: { id: 'sub-uuid-1' },
        data: expect.objectContaining({
          status: 'ACCEPTED',
          score: 100,
          userOutput: 'OK',
          executionTimeMs: 10,
        }),
      });

      expect(prisma.submission.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-uuid-1',
          problemId: 1,
          status: 'ACCEPTED',
          id: { not: 'sub-uuid-1' },
        },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: {
          solvedCount: { increment: 1 },
          rating: { increment: 10 },
        },
      });
    });

    it('should not update user stats if there was a previous ACCEPTED submission', async () => {
      judgeService.enqueue.mockResolvedValue({
        status: 'ACCEPTED',
        executionTimeMs: 10,
        stdout: 'OK',
      });
      prisma.submission.count.mockResolvedValue(2);

      await (service as any).runJudgeForSubmission({
        submissionId: 'sub-uuid-1',
        problemId: 1,
        userId: 'user-uuid-1',
        language: 'javascript',
        sourceCode: '',
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should not update user stats for non-ACCEPTED outcomes', async () => {
      judgeService.enqueue.mockResolvedValue({
        status: 'WRONG_ANSWER',
        executionTimeMs: 10,
        stdout: 'wrong',
      });

      await (service as any).runJudgeForSubmission({
        submissionId: 'sub-uuid-1',
        problemId: 1,
        userId: 'user-uuid-1',
        language: 'javascript',
        sourceCode: '',
      });

      expect(prisma.submission.update).toHaveBeenLastCalledWith({
        where: { id: 'sub-uuid-1' },
        data: expect.objectContaining({
          status: 'WRONG_ANSWER',
        }),
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should map INTERNAL_ERROR to RUNTIME_ERROR', async () => {
      judgeService.enqueue.mockResolvedValue({
        status: 'INTERNAL_ERROR',
        executionTimeMs: 0,
        stdout: '',
      });

      await (service as any).runJudgeForSubmission({
        submissionId: 'sub-uuid-1',
        problemId: 1,
        userId: 'user-uuid-1',
        language: 'javascript',
        sourceCode: '',
      });

      expect(prisma.submission.update).toHaveBeenLastCalledWith({
        where: { id: 'sub-uuid-1' },
        data: expect.objectContaining({
          status: 'RUNTIME_ERROR',
        }),
      });
    });

    it('should skip stats update when submission cannot be reloaded', async () => {
      judgeService.enqueue.mockResolvedValue({
        status: 'ACCEPTED',
        executionTimeMs: 10,
        stdout: 'OK',
      });
      prisma.submission.findUnique.mockResolvedValue(null);

      await (service as any).runJudgeForSubmission({
        submissionId: 'sub-uuid-1',
        problemId: 1,
        userId: 'user-uuid-1',
        language: 'javascript',
        sourceCode: '',
      });

      expect(prisma.submission.count).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
