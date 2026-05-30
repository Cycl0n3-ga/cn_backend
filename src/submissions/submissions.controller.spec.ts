import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { NotFoundException } from '@nestjs/common';

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let service: jest.Mocked<SubmissionsService>;

  const mockCreateResult = {
    submission_id: 'sub-uuid-1',
    status: 'PENDING',
  };

  const mockFindOneResult = {
    submission_id: 'sub-uuid-1',
    problem_id: '1',
    language: 'python3',
    status: 'ACCEPTED',
    score: '100',
    user_answer: '[0,1]',
    compile_message: '',
    metrics: {
      execution_time_ms: '45',
      memory_usage_kb: '2048',
    },
    submitted_at: new Date('2026-05-13T12:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [
        {
          provide: SubmissionsService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SubmissionsController>(SubmissionsController);
    service = module.get(SubmissionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create submission and return PENDING status', async () => {
      service.create.mockResolvedValue(
        mockCreateResult as { submission_id: string; status: 'PENDING' },
      );

      const result = await controller.create(
        { user: { id: 'user-uuid-1' } },
        {
          problem_id: 1,
          language: 'python3',
          source_code: 'def solve(): pass',
        },
      );

      expect(result).toEqual(mockCreateResult);
    });

    it('should pass req.user.id to service as userId', async () => {
      service.create.mockResolvedValue(
        mockCreateResult as { submission_id: string; status: 'PENDING' },
      );

      await controller.create(
        { user: { id: 'user-uuid-42' } },
        {
          problem_id: 1,
          language: 'cpp',
          source_code: '#include',
        },
      );

      expect(service.create).toHaveBeenCalledWith('user-uuid-42', {
        problemId: 1,
        language: 'cpp',
        sourceCode: '#include',
      });
    });

    it('should map DTO fields to service parameter names', async () => {
      service.create.mockResolvedValue(
        mockCreateResult as { submission_id: string; status: 'PENDING' },
      );

      await controller.create(
        { user: { id: 'uid' } },
        {
          problem_id: 5,
          language: 'java',
          source_code: 'class Solution {}',
        },
      );

      const call = service.create.mock.calls[0];
      expect(call[0]).toBe('uid');
      expect(call[1]).toEqual({
        problemId: 5,
        language: 'java',
        sourceCode: 'class Solution {}',
      });
    });

    it('should propagate NotFoundException for non-existent problem', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(
        controller.create(
          { user: { id: 'uid' } },
          {
            problem_id: 999,
            language: 'python3',
            source_code: 'code',
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate error message correctly', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Problem #42 not found.'),
      );

      await expect(
        controller.create(
          { user: { id: 'uid' } },
          {
            problem_id: 42,
            language: 'python3',
            source_code: 'code',
          },
        ),
      ).rejects.toThrow('Problem #42 not found.');
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return submission details', async () => {
      service.findOne.mockResolvedValue(mockFindOneResult);

      const result = await controller.findOne('sub-uuid-1');

      expect(result).toEqual(mockFindOneResult);
    });

    it('should pass submission ID directly to service', async () => {
      service.findOne.mockResolvedValue(mockFindOneResult);

      await controller.findOne('my-submission-id');

      expect(service.findOne).toHaveBeenCalledWith('my-submission-id');
    });

    it('should propagate NotFoundException for non-existent submission', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Submission "bad-id" not found.'),
      );

      await expect(controller.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return all expected fields', async () => {
      service.findOne.mockResolvedValue(mockFindOneResult);

      const result = await controller.findOne('sub-uuid-1');

      expect(result).toHaveProperty('submission_id');
      expect(result).toHaveProperty('problem_id');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('submitted_at');
    });
  });
});
