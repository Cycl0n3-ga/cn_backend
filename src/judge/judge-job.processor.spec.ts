import { Test, TestingModule } from '@nestjs/testing';
import { JudgeJobProcessor } from './judge-job.processor.js';
import { JudgeService } from './judge.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('JudgeJobProcessor', () => {
  let processor: JudgeJobProcessor;
  let prisma: any;
  let judgeService: jest.Mocked<JudgeService>;

  const mockSubmission = {
    id: 'sub-uuid-1',
    userId: 'user-uuid-1',
    problemId: 1,
    language: 'javascript',
    sourceCode: 'module.exports = input => input',
    status: 'PENDING',
    finishedAt: null,
    problem: {
      id: 1,
      timeLimitMs: 1000,
      memoryLimitMb: 256,
    },
  };

  beforeEach(async () => {
    prisma = {
      submission: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn(),
      },
      testCase: {
        findMany: jest.fn(),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JudgeJobProcessor,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JudgeService,
          useValue: {
            run: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get(JudgeJobProcessor);
    judgeService = module.get(JudgeService);
  });

  it('should process an accepted submission and update first-solve stats', async () => {
    prisma.submission.findUnique.mockResolvedValue(mockSubmission);
    prisma.testCase.findMany.mockResolvedValue([{ input: 'OK', output: 'OK' }]);
    prisma.submission.count.mockResolvedValue(0);
    judgeService.run.mockResolvedValue({
      status: 'ACCEPTED',
      stdout: 'OK',
      stderr: '',
      expectedOutput: 'OK',
      score: 100,
      executionTimeMs: 12,
    });

    await processor.processSubmission('sub-uuid-1', {
      jobId: 'sub-uuid-1',
      attempt: 1,
    });

    expect(judgeService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      }),
    );
    expect(prisma.submission.update).toHaveBeenLastCalledWith({
      where: { id: 'sub-uuid-1' },
      data: expect.objectContaining({
        status: 'ACCEPTED',
        score: 100,
        userOutput: 'OK',
        executionTimeMs: 12,
        finishedAt: expect.any(Date),
      }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-uuid-1' },
      data: {
        solvedCount: { increment: 1 },
        rating: { increment: 10 },
      },
    });
  });

  it('should map judge internal errors to runtime error', async () => {
    prisma.submission.findUnique.mockResolvedValue(mockSubmission);
    prisma.testCase.findMany.mockResolvedValue([{ input: '1', output: '2' }]);
    judgeService.run.mockResolvedValue({
      status: 'INTERNAL_ERROR',
      stdout: '',
      stderr: 'Docker unavailable',
      expectedOutput: '2',
      score: 0,
      executionTimeMs: 0,
    });

    await processor.processSubmission('sub-uuid-1', {
      jobId: 'sub-uuid-1',
      attempt: 1,
    });

    expect(prisma.submission.update).toHaveBeenLastCalledWith({
      where: { id: 'sub-uuid-1' },
      data: expect.objectContaining({
        status: 'RUNTIME_ERROR',
        score: 0,
      }),
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should skip already terminal submissions', async () => {
    prisma.submission.findUnique.mockResolvedValue({
      ...mockSubmission,
      status: 'ACCEPTED',
      finishedAt: new Date(),
    });

    await processor.processSubmission('sub-uuid-1', {
      jobId: 'sub-uuid-1',
      attempt: 2,
    });

    expect(judgeService.run).not.toHaveBeenCalled();
  });
});
