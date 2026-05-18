import { Test, TestingModule } from '@nestjs/testing';
import { ProblemsService } from './problems.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ProblemsService', () => {
  let service: ProblemsService;
  let prisma: any;

  const mockProblem = {
    id: 1,
    title: 'Two Sum',
    description: 'Given an array of integers...',
    difficulty: 'EASY',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    functionName: 'twoSum',
    acceptanceRate: 0.49,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      problem: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      assignment: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProblemsService>(ProblemsService);
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated problem list with total and page', async () => {
      prisma.problem.count.mockResolvedValue(2);
      prisma.problem.findMany.mockResolvedValue([
        { id: 1, title: 'Two Sum', difficulty: 'EASY', acceptanceRate: 0.49 },
        { id: 2, title: 'Add Two Numbers', difficulty: 'MEDIUM', acceptanceRate: 0.39 },
      ]);

      const result = await service.findAll(1, 20);

      expect(result.total).toBe('2');
      expect(result.page).toBe('1');
      expect(result.items).toHaveLength(2);
    });

    it('should map problem fields to snake_case API format', async () => {
      prisma.problem.count.mockResolvedValue(1);
      prisma.problem.findMany.mockResolvedValue([
        { id: 1, title: 'Two Sum', difficulty: 'EASY', acceptanceRate: 0.49 },
      ]);

      const result = await service.findAll(1, 20);

      expect(result.items[0]).toMatchObject({
        problem_id: '1',
        title: 'Two Sum',
        difficulty: 'EASY',
        acceptance_rate: '0.49',
      });
    });

    it('should return all numeric fields as strings', async () => {
      prisma.problem.count.mockResolvedValue(1);
      prisma.problem.findMany.mockResolvedValue([
        { id: 1, title: 'Two Sum', difficulty: 'EASY', acceptanceRate: 0.49 },
      ]);

      const result = await service.findAll(1, 20);

      expect(typeof result.total).toBe('string');
      expect(typeof result.page).toBe('string');
      expect(typeof result.items[0].problem_id).toBe('string');
      expect(typeof result.items[0].acceptance_rate).toBe('string');
    });

    it('should filter by difficulty (EASY)', async () => {
      prisma.problem.count.mockResolvedValue(1);
      prisma.problem.findMany.mockResolvedValue([
        { id: 1, title: 'Two Sum', difficulty: 'EASY', acceptanceRate: 0.49 },
      ]);

      await service.findAll(1, 20, 'EASY');

      expect(prisma.problem.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ difficulty: 'EASY' }) }),
      );
      expect(prisma.problem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ difficulty: 'EASY' }) }),
      );
    });

    it('should accept lowercase difficulty and uppercase it', async () => {
      prisma.problem.count.mockResolvedValue(0);
      prisma.problem.findMany.mockResolvedValue([]);

      await service.findAll(1, 20, 'medium');

      expect(prisma.problem.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ difficulty: 'MEDIUM' }) }),
      );
    });

    it('should apply correct pagination offset', async () => {
      prisma.problem.count.mockResolvedValue(50);
      prisma.problem.findMany.mockResolvedValue([]);

      await service.findAll(3, 10);

      expect(prisma.problem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should only query non-deleted problems', async () => {
      prisma.problem.count.mockResolvedValue(0);
      prisma.problem.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.problem.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isDeleted: false }) }),
      );
    });

    it('should return empty items array when no problems', async () => {
      prisma.problem.count.mockResolvedValue(0);
      prisma.problem.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.total).toBe('0');
      expect(result.items).toHaveLength(0);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return problem details with sample test cases', async () => {
      prisma.problem.findFirst.mockResolvedValue({
        ...mockProblem,
        testCases: [
          { input: '[2,7,11,15]\n9', output: '[0,1]' },
          { input: '[3,2,4]\n6', output: '[1,2]' },
        ],
      });

      const result = await service.findOne(1);

      expect(result.problem_id).toBe('1');
      expect(result.title).toBe('Two Sum');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('difficulty', 'EASY');
      expect(result).toHaveProperty('function_name', 'twoSum');
      expect(result).toHaveProperty('constraints');
      expect(result).toHaveProperty('sample_test_cases');
      expect(result.sample_test_cases).toHaveLength(2);
    });

    it('should return constraints as strings', async () => {
      prisma.problem.findFirst.mockResolvedValue({ ...mockProblem, testCases: [] });

      const result = await service.findOne(1);

      expect(typeof result.constraints.time_limit_ms).toBe('string');
      expect(typeof result.constraints.memory_limit_mb).toBe('string');
      expect(result.constraints.time_limit_ms).toBe('1000');
      expect(result.constraints.memory_limit_mb).toBe('256');
    });

    it('should return function_name as empty string when null', async () => {
      prisma.problem.findFirst.mockResolvedValue({
        ...mockProblem,
        functionName: null,
        testCases: [],
      });

      const result = await service.findOne(1);

      expect(result.function_name).toBe('');
    });

    it('should only fetch non-hidden test cases', async () => {
      prisma.problem.findFirst.mockResolvedValue({ ...mockProblem, testCases: [] });

      await service.findOne(1);

      expect(prisma.problem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            testCases: expect.objectContaining({
              where: { isHidden: false },
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent problem', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with problem ID in message', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(service.findOne(42)).rejects.toThrow('Problem #42 not found.');
    });
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create a problem and return problem_id and title', async () => {
      prisma.problem.create.mockResolvedValue({
        id: 10,
        title: 'New Problem',
        testCases: [{ input: '1', output: '1' }],
      });

      const result = await service.create({
        title: 'New Problem',
        description: 'Test description',
        difficulty: 'EASY',
        testCases: [{ input: '1', output: '1' }],
      });

      expect(result).toHaveProperty('problem_id', '10');
      expect(result).toHaveProperty('title', 'New Problem');
    });

    it('should default timeLimitMs to 1000 and memoryLimitMb to 256', async () => {
      prisma.problem.create.mockResolvedValue({ id: 1, title: 'Test', testCases: [] });

      await service.create({
        title: 'Test',
        description: 'Desc',
        difficulty: 'EASY',
        testCases: [],
      });

      const createCall = prisma.problem.create.mock.calls[0][0];
      expect(createCall.data.timeLimitMs).toBe(1000);
      expect(createCall.data.memoryLimitMb).toBe(256);
    });

    it('should use provided timeLimitMs and memoryLimitMb', async () => {
      prisma.problem.create.mockResolvedValue({ id: 1, title: 'Test', testCases: [] });

      await service.create({
        title: 'Test',
        description: 'Desc',
        difficulty: 'HARD',
        timeLimitMs: 3000,
        memoryLimitMb: 512,
        testCases: [],
      });

      const createCall = prisma.problem.create.mock.calls[0][0];
      expect(createCall.data.timeLimitMs).toBe(3000);
      expect(createCall.data.memoryLimitMb).toBe(512);
    });

    it('should default test case isHidden to true', async () => {
      prisma.problem.create.mockResolvedValue({ id: 1, title: 'Test', testCases: [] });

      await service.create({
        title: 'Test',
        description: 'Desc',
        difficulty: 'EASY',
        testCases: [{ input: '1', output: '1' }],
      });

      const createCall = prisma.problem.create.mock.calls[0][0];
      expect(createCall.data.testCases.create[0].isHidden).toBe(true);
    });

    it('should allow setting isHidden to false', async () => {
      prisma.problem.create.mockResolvedValue({ id: 1, title: 'Test', testCases: [] });

      await service.create({
        title: 'Test',
        description: 'Desc',
        difficulty: 'EASY',
        testCases: [{ input: '1', output: '1', isHidden: false }],
      });

      const createCall = prisma.problem.create.mock.calls[0][0];
      expect(createCall.data.testCases.create[0].isHidden).toBe(false);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should soft-delete a problem (set isDeleted=true)', async () => {
      prisma.problem.findUnique.mockResolvedValue(mockProblem);
      prisma.problem.update.mockResolvedValue({});

      await service.remove(1);

      expect(prisma.problem.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isDeleted: true },
      });
    });

    it('should throw NotFoundException for non-existent problem', async () => {
      prisma.problem.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should check existence by id before deleting', async () => {
      prisma.problem.findUnique.mockResolvedValue(mockProblem);
      prisma.problem.update.mockResolvedValue({});

      await service.remove(1);

      expect(prisma.problem.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  // ── assign ────────────────────────────────────────────────────────────
  describe('assign', () => {
    const mockUserAlice = { id: 'alice-uuid', username: 'alice' };

    it('should assign problem to user and return assignment info', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.user.findUnique.mockResolvedValue(mockUserAlice);
      prisma.assignment.upsert.mockResolvedValue({ id: 1 });

      const result = await service.assign(1, 'alice');

      expect(result).toHaveProperty('message', 'Assignment created successfully.');
      expect(result).toHaveProperty('assignment_id', '1');
      expect(result).toHaveProperty('problem_id', '1');
      expect(result).toHaveProperty('assignee', 'alice');
    });

    it('should return all numeric IDs as strings', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.user.findUnique.mockResolvedValue(mockUserAlice);
      prisma.assignment.upsert.mockResolvedValue({ id: 5 });

      const result = await service.assign(1, 'alice');

      expect(typeof result.assignment_id).toBe('string');
      expect(typeof result.problem_id).toBe('string');
    });

    it('should throw NotFoundException if problem does not exist or is deleted', async () => {
      prisma.problem.findFirst.mockResolvedValue(null);

      await expect(service.assign(999, 'alice')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.assign(1, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should use upsert to avoid duplicate assignments', async () => {
      prisma.problem.findFirst.mockResolvedValue(mockProblem);
      prisma.user.findUnique.mockResolvedValue(mockUserAlice);
      prisma.assignment.upsert.mockResolvedValue({ id: 1 });

      await service.assign(1, 'alice');

      expect(prisma.assignment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { problemId_userId: { problemId: 1, userId: 'alice-uuid' } },
          create: { problemId: 1, userId: 'alice-uuid' },
        }),
      );
    });
  });
});
