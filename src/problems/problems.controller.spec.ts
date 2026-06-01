import { Test, TestingModule } from '@nestjs/testing';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { NotFoundException } from '@nestjs/common';

describe('ProblemsController', () => {
  let controller: ProblemsController;
  let service: jest.Mocked<ProblemsService>;

  const mockFindAllResult = {
    total: '5',
    page: '1',
    items: [
      {
        problem_id: '1',
        title: 'Two Sum',
        difficulty: 'EASY',
        acceptance_rate: '0.49',
        creator: {
          id: 'admin-uuid',
          username: 'admin',
          email: 'admin@codejudge.dev',
        },
        assignedCount: '1',
        submittedCount: '2',
        acceptedCount: '1',
        failedCount: '1',
      },
      {
        problem_id: '2',
        title: 'Add Two Numbers',
        difficulty: 'MEDIUM',
        acceptance_rate: '0.39',
        creator: null,
        assignedCount: '0',
        submittedCount: '0',
        acceptedCount: '0',
        failedCount: '0',
      },
    ],
  };

  const mockFindOneResult = {
    problem_id: '1',
    title: 'Two Sum',
    description: 'Given an array...',
    difficulty: 'EASY',
    function_name: 'twoSum',
    creator: {
      id: 'admin-uuid',
      username: 'admin',
      email: 'admin@codejudge.dev',
    },
    assignedCount: '1',
    submittedCount: '2',
    acceptedCount: '1',
    failedCount: '1',
    constraints: { time_limit_ms: '1000', memory_limit_mb: '256' },
    sample_test_cases: [{ input: '[2,7]', output: '[0,1]' }],
  };

  const mockCreateResult = {
    problem_id: '10',
    title: 'New Problem',
    creator: {
      id: 'admin-uuid',
      username: 'admin',
      email: 'admin@codejudge.dev',
    },
  };

  const mockUpdateResult = {
    problem_id: '1',
    title: 'Updated Problem',
    description: 'Updated description',
    difficulty: 'MEDIUM',
    function_name: 'solve',
    creator: {
      id: 'admin-uuid',
      username: 'admin',
      email: 'admin@codejudge.dev',
    },
    assignedCount: '0',
    submittedCount: '0',
    acceptedCount: '0',
    failedCount: '0',
    constraints: {
      time_limit_ms: '1500',
      memory_limit_mb: '512',
    },
    sample_test_cases: [{ input: '1', output: '1' }],
  };

  const mockAssignResult = {
    message: 'Assignment created successfully.',
    assignment_id: '1',
    problem_id: '1',
    assignee: 'alice',
  };
  const mockRequest = { user: { id: 'admin-uuid' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProblemsController],
      providers: [
        {
          provide: ProblemsService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            assign: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProblemsController>(ProblemsController);
    service = module.get(ProblemsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated problem list', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      const result = await controller.findAll('1', '10', 'EASY');

      expect(result).toEqual(mockFindAllResult);
    });

    it('should pass parsed page and limit to service', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      await controller.findAll('2', '15', 'HARD');

      expect(service.findAll).toHaveBeenCalledWith(2, 15, 'HARD');
    });

    it('should default page to 1 when not provided', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      await controller.findAll(undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should default limit to 20 when not provided', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      await controller.findAll('1', undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should pass difficulty filter to service', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      await controller.findAll('1', '10', 'MEDIUM');

      expect(service.findAll).toHaveBeenCalledWith(1, 10, 'MEDIUM');
    });

    it('should handle undefined difficulty', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      await controller.findAll('1', '10');

      expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return problem details', async () => {
      service.findOne.mockResolvedValue(mockFindOneResult);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockFindOneResult);
    });

    it('should pass problem ID directly to service', async () => {
      service.findOne.mockResolvedValue(mockFindOneResult);

      await controller.findOne(42);

      expect(service.findOne).toHaveBeenCalledWith(42);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should propagate error message correctly', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(
        'Problem #999 not found.',
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create problem and return result', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create(
        {
          title: 'New Problem',
          description: 'Test description',
          difficulty: 'EASY',
          test_cases: [{ input: '1', output: '1' }],
        },
        mockRequest,
      );

      expect(result).toEqual(mockCreateResult);
    });

    it('should map DTO fields to service parameters correctly', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      await controller.create(
        {
          title: 'Problem',
          description: 'Desc',
          difficulty: 'HARD',
          function_name: 'solve',
          time_limit_ms: 2000,
          memory_limit_mb: 512,
          test_cases: [
            { input: '1', output: '2', is_hidden: true },
            { input: '3', output: '4', is_hidden: false },
          ],
        },
        mockRequest,
      );

      expect(service.create).toHaveBeenCalledWith({
        title: 'Problem',
        description: 'Desc',
        difficulty: 'HARD',
        functionName: 'solve',
        creatorId: 'admin-uuid',
        timeLimitMs: 2000,
        memoryLimitMb: 512,
        testCases: [
          { input: '1', output: '2', isHidden: true },
          { input: '3', output: '4', isHidden: false },
        ],
      });
    });

    it('should default is_hidden to true when not provided', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      await controller.create(
        {
          title: 'T',
          description: 'D',
          difficulty: 'EASY',
          test_cases: [{ input: '1', output: '1' }],
        },
        mockRequest,
      );

      const call = service.create.mock.calls[0][0];
      expect(call.testCases[0].isHidden).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update problem and return result', async () => {
      service.update.mockResolvedValue(mockUpdateResult);

      const result = await controller.update(1, {
        title: 'Updated Title',
        description: 'New desc',
      });

      expect(result).toEqual(mockUpdateResult);
      expect(service.update).toHaveBeenCalledWith(1, {
        title: 'Updated Title',
        description: 'New desc',
        difficulty: undefined,
        functionName: undefined,
        timeLimitMs: undefined,
        memoryLimitMb: undefined,
        testCases: undefined,
      });
    });

    it('should map test cases DTO to service format', async () => {
      service.update.mockResolvedValue(mockUpdateResult);

      await controller.update(1, {
        test_cases: [{ input: 'new-in', output: 'new-out', is_hidden: false }],
      });

      expect(service.update).toHaveBeenCalledWith(1, {
        title: undefined,
        description: undefined,
        difficulty: undefined,
        functionName: undefined,
        timeLimitMs: undefined,
        memoryLimitMb: undefined,
        testCases: [{ input: 'new-in', output: 'new-out', isHidden: false }],
      });
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(controller.update(999, { title: 'No' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should call service.remove with correct id', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('should propagate NotFoundException from service', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── assign ────────────────────────────────────────────────────────────
  describe('assign', () => {
    it('should assign problem and return result', async () => {
      service.assign.mockResolvedValue(mockAssignResult);

      const result = await controller.assign(1, { assignee_username: 'alice' });

      expect(result).toEqual(mockAssignResult);
    });

    it('should pass problem ID and assignee_username to service', async () => {
      service.assign.mockResolvedValue(mockAssignResult);

      await controller.assign(5, { assignee_username: 'bob' });

      expect(service.assign).toHaveBeenCalledWith(5, 'bob');
    });

    it('should propagate NotFoundException when problem not found', async () => {
      service.assign.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(
        controller.assign(999, { assignee_username: 'alice' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when user not found', async () => {
      service.assign.mockRejectedValue(
        new NotFoundException('User "ghost" not found.'),
      );

      await expect(
        controller.assign(1, { assignee_username: 'ghost' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
