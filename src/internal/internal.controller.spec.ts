import { Test, TestingModule } from '@nestjs/testing';
import { InternalController } from './internal.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('InternalController', () => {
  let controller: InternalController;
  let prisma: any;

  const mockProblem = {
    id: 1,
    title: 'Two Sum',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    isDeleted: false,
    testCases: [
      { input: '[2,7,11,15]\n9', output: '[0,1]' },
      { input: '[3,2,4]\n6', output: '[1,2]' },
      { input: '[3,3]\n6', output: '[0,1]' },
    ],
  };

  beforeEach(async () => {
    prisma = {
      problem: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<InternalController>(InternalController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getTestCases ──────────────────────────────────────────────────────
  describe('getTestCases', () => {
    it('should return all test cases (including hidden) for valid problem', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);

      const result = await controller.getTestCases(1);

      expect(result).toHaveProperty('problem_id', '1');
      expect(result).toHaveProperty('time_limit_ms', '1000');
      expect(result).toHaveProperty('memory_limit_mb', '256');
      expect(result).toHaveProperty('test_cases');
      expect(result.test_cases).toHaveLength(3);
    });

    it('should return all numeric fields as strings', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);

      const result = await controller.getTestCases(1);

      expect(typeof result.problem_id).toBe('string');
      expect(typeof result.time_limit_ms).toBe('string');
      expect(typeof result.memory_limit_mb).toBe('string');
    });

    it('should include both visible and hidden test cases', async () => {
      // Internal endpoint returns ALL test cases (no isHidden filter)
      prisma.problem.findFirst.mockResolvedValue({
        ...mockProblem,
        testCases: [
          { input: 'visible_input', output: 'visible_output' },
          { input: 'hidden_input', output: 'hidden_output' },
        ],
      });

      const result = await controller.getTestCases(1);

      expect(result.test_cases).toHaveLength(2);
    });

    it('should query without isHidden filter (all test cases for judge)', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);

      await controller.getTestCases(1);

      expect(prisma.problem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1, isDeleted: false },
          include: {
            testCases: {
              select: { input: true, output: true },
            },
          },
        }),
      );
    });

    it('should return correct test case structure (input, output only)', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);

      const result = await controller.getTestCases(1);

      expect(result.test_cases[0]).toHaveProperty('input');
      expect(result.test_cases[0]).toHaveProperty('output');
      // Should NOT expose isHidden flag to worker
      expect(result.test_cases[0]).not.toHaveProperty('isHidden');
    });

    it('should throw NotFoundException for non-existent problem', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(controller.getTestCases(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for deleted problem', async () => {
      prisma.problem.findFirst.mockResolvedValue(null); // isDeleted: true returns null from findFirst

      await expect(controller.getTestCases(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with problem ID in message', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(controller.getTestCases(42)).rejects.toThrow(
        'Problem #42 not found.',
      );
    });
  });
});
