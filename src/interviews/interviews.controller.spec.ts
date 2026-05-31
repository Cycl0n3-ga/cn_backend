import { Test, TestingModule } from '@nestjs/testing';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { NotFoundException } from '@nestjs/common';

describe('InterviewsController', () => {
  let controller: InterviewsController;
  let service: jest.Mocked<InterviewsService>;

  const mockCreateResult = {
    id: '1',
    jobRole: 'Backend Developer',
    examinerEmpId: 'user-uuid-1',
  };

  const mockFindAllResult = [
    { id: '1', jobRole: 'Backend Developer', examinerEmpId: 'user-uuid-1' },
    { id: '2', jobRole: 'Frontend Developer', examinerEmpId: 'user-uuid-2' },
  ];

  const mockUpdateResult = {
    id: '1',
    jobRole: 'Senior Backend Developer',
    examinerEmpId: 'user-uuid-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewsController],
      providers: [
        {
          provide: InterviewsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InterviewsController>(InterviewsController);
    service = module.get(InterviewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create interview and return result', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create(
        { user: { id: 'user-uuid-1' } } as any,
        {
          jobRole: 'Backend Developer',
        }
      );

      expect(result).toEqual(mockCreateResult);
    });

    it('should pass DTO directly to service', async () => {
      service.create.mockResolvedValue(mockCreateResult);
      const dto = { jobRole: 'Frontend Dev' };

      await controller.create({ user: { id: 'examiner-uuid' } } as any, dto);

      expect(service.create).toHaveBeenCalledWith('examiner-uuid', dto);
    });

    it('should pass candidate and problem counts to service', async () => {
      service.create.mockResolvedValue({
        ...mockCreateResult,
        candidate: { id: '7', jobId: '1', userId: 'candidate-uuid' },
        problemCounts: { easy: 2, medium: 1, hard: 0 },
        assignments: [],
      });
      const dto = {
        jobRole: 'Backend Developer',
        examinerEmpId: 'user-uuid-1',
        candidateUserId: 'candidate-uuid',
        problemCounts: { easy: 2, medium: 1, hard: 0 },
      };

      await controller.create({ user: { id: 'user-uuid-1' } } as any, dto);

      expect(service.create).toHaveBeenCalledWith('user-uuid-1', dto);
    });

    it('should return id as string', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create(
        { user: { id: 'uid' } } as any,
        {
          jobRole: 'Test',
        }
      );

      expect(typeof result.id).toBe('string');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all interviews', async () => {
      service.findAll.mockResolvedValue({
        data: mockFindAllResult as any,
        total: 2,
        page: 1,
        limit: 20,
      });

      const result = await controller.findAll();

      expect(result).toEqual({
        data: mockFindAllResult,
        total: 2,
        page: 1,
        limit: 20,
      });
      expect(result.data).toHaveLength(2);
    });

    it('should call service.findAll once', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no interviews', async () => {
      service.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      const result = await controller.findAll();

      expect(result.data).toHaveLength(0);
    });
  });

  // ── update ────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update interview and return result', async () => {
      service.update.mockResolvedValue(mockUpdateResult);

      const result = await controller.update(1, {
        jobRole: 'Senior Backend Developer',
      });

      expect(result).toEqual(mockUpdateResult);
    });

    it('should pass id and DTO to service', async () => {
      service.update.mockResolvedValue(mockUpdateResult);

      await controller.update(5, { jobRole: 'Updated Role' });

      expect(service.update).toHaveBeenCalledWith(5, {
        jobRole: 'Updated Role',
      });
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Interview #999 not found.'),
      );

      await expect(controller.update(999, { jobRole: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate error message correctly', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Interview #42 not found.'),
      );

      await expect(controller.update(42, { jobRole: 'Test' })).rejects.toThrow(
        'Interview #42 not found.',
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
        new NotFoundException('Interview #999 not found.'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should not throw for existing interview', async () => {
      service.remove.mockResolvedValue(undefined);

      await expect(controller.remove(1)).resolves.not.toThrow();
    });
  });
});
