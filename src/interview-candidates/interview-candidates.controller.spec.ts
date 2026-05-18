import { Test, TestingModule } from '@nestjs/testing';
import { InterviewCandidatesController } from './interview-candidates.controller';
import { InterviewCandidatesService } from './interview-candidates.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('InterviewCandidatesController', () => {
  let controller: InterviewCandidatesController;
  let service: jest.Mocked<InterviewCandidatesService>;

  const mockCreateResult = {
    id: '1',
    jobId: '1',
    userId: 'user-uuid-1',
  };

  const mockFindAllResult = [
    {
      id: '1',
      jobId: '1',
      userId: 'user-uuid-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      interview: { id: '1', jobRole: 'Backend Developer', examinerEmpId: 'examiner-uuid' },
      user: { id: 'user-uuid-1', username: 'alice', email: 'alice@example.com' },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewCandidatesController],
      providers: [
        {
          provide: InterviewCandidatesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InterviewCandidatesController>(InterviewCandidatesController);
    service = module.get(InterviewCandidatesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create candidate and return result', async () => {
      service.create.mockResolvedValue(mockCreateResult as any);

      const result = await controller.create({ jobId: 1, userId: 'user-uuid-1' });

      expect(result).toEqual(mockCreateResult);
    });

    it('should pass DTO directly to service', async () => {
      service.create.mockResolvedValue(mockCreateResult as any);
      const dto = { jobId: 5, userId: 'user-uuid-42' };

      await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should return id and jobId as strings', async () => {
      service.create.mockResolvedValue(mockCreateResult as any);

      const result = await controller.create({ jobId: 1, userId: 'uid' });

      expect(typeof result.id).toBe('string');
      expect(typeof result.jobId).toBe('string');
    });

    it('should propagate NotFoundException when interview not found', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Interview #999 not found.'),
      );

      await expect(
        controller.create({ jobId: 999, userId: 'uid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when user not found', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('User #nonexistent not found.'),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ConflictException for duplicate candidate', async () => {
      service.create.mockRejectedValue(
        new ConflictException('User is already a candidate for this interview.'),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'user-uuid-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate ConflictException with correct message', async () => {
      service.create.mockRejectedValue(
        new ConflictException('User is already a candidate for this interview.'),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'user-uuid-1' }),
      ).rejects.toThrow('User is already a candidate for this interview.');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all candidates', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult as any);

      const result = await controller.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result).toEqual(mockFindAllResult);
    });

    it('should call service.findAll', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should call service.remove with correct id', async () => {
      service.remove.mockResolvedValue(undefined as any);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('should propagate NotFoundException for non-existent candidate', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('InterviewCandidate #999 not found.'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should not throw for existing candidate', async () => {
      service.remove.mockResolvedValue(undefined as any);

      await expect(controller.remove(1)).resolves.not.toThrow();
    });

    it('should propagate error message correctly', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('InterviewCandidate #42 not found.'),
      );

      await expect(controller.remove(42)).rejects.toThrow(
        'InterviewCandidate #42 not found.',
      );
    });
  });
});
