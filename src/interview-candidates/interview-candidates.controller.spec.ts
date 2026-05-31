import { Test, TestingModule } from '@nestjs/testing';
import { InterviewCandidatesController } from './interview-candidates.controller';
import { InterviewCandidatesService } from './interview-candidates.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

describe('InterviewCandidatesController', () => {
  let controller: InterviewCandidatesController;
  let service: jest.Mocked<InterviewCandidatesService>;

  const mockCreateResult = {
    id: '1',
    jobId: '1',
    userId: 'user-uuid-1',
    startTime: null,
    endTime: null,
  };

  const mockUpdateTimeResult = {
    id: '1',
    jobId: '1',
    userId: 'user-uuid-1',
    startTime: 1770000000,
    endTime: 1770003600,
  };

  const mockFindAllResult = [
    {
      id: '1',
      jobId: '1',
      userId: 'user-uuid-1',
      startTime: 1770000000,
      endTime: 1770003600,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      interview: {
        id: '1',
        jobRole: 'Backend Developer',
        examinerEmpId: 'examiner-uuid',
      },
      user: {
        id: 'user-uuid-1',
        username: 'alice',
        role: 'CANDIDATE',
      },
    },
  ];

  const mockTimeStatusResult = {
    id: '1',
    jobId: '1',
    userId: 'user-uuid-1',
    serverTime: 1770000300,
    startTime: 1770000000,
    endTime: 1770003600,
    remainingTime: 3300,
    elapsedTime: 300,
    duration: 3600,
    timeUntilStart: 0,
    status: 'IN_PROGRESS' as const,
  };

  const mockRequest = {
    user: {
      id: 'user-uuid-1',
      role: 'CANDIDATE',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewCandidatesController],
      providers: [
        {
          provide: InterviewCandidatesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            getTimeStatus: jest.fn(),
            updateTime: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InterviewCandidatesController>(
      InterviewCandidatesController,
    );
    service = module.get(InterviewCandidatesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create candidate and return result', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create({
        jobId: 1,
        userId: 'user-uuid-1',
      });

      expect(result).toEqual(mockCreateResult);
    });

    it('should pass DTO directly to service', async () => {
      service.create.mockResolvedValue(mockCreateResult);
      const dto = { jobId: 5, userId: 'user-uuid-42' };

      await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should return id and jobId as strings', async () => {
      service.create.mockResolvedValue(mockCreateResult);

      const result = await controller.create({ jobId: 1, userId: 'uid' });

      expect(typeof result.id).toBe('string');
      expect(typeof result.jobId).toBe('string');
    });

    it('should pass optional time fields to service', async () => {
      service.create.mockResolvedValue(mockUpdateTimeResult);
      const dto = {
        jobId: 1,
        userId: 'user-uuid-1',
        startTime: 1770000000,
        endTime: 1770003600,
      };

      await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
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
        new ConflictException(
          'User is already a candidate for this interview.',
        ),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'user-uuid-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate ConflictException with correct message', async () => {
      service.create.mockRejectedValue(
        new ConflictException(
          'User is already a candidate for this interview.',
        ),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'user-uuid-1' }),
      ).rejects.toThrow('User is already a candidate for this interview.');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all candidates', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

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

  // ── getTimeStatus ────────────────────────────────────────────────────
  describe('getTimeStatus', () => {
    it('should return candidate time status', async () => {
      service.getTimeStatus.mockResolvedValue(mockTimeStatusResult);

      const result = await controller.getTimeStatus(1, mockRequest);

      expect(result).toEqual(mockTimeStatusResult);
      expect(service.getTimeStatus).toHaveBeenCalledWith(1, mockRequest.user);
    });

    it('should propagate NotFoundException from service', async () => {
      service.getTimeStatus.mockRejectedValue(
        new NotFoundException('InterviewCandidate #999 not found.'),
      );

      await expect(controller.getTimeStatus(999, mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateTime ───────────────────────────────────────────────────────
  describe('updateTime', () => {
    it('should update candidate time and return result', async () => {
      service.updateTime.mockResolvedValue(mockUpdateTimeResult);

      const result = await controller.updateTime(1, {
        startTime: 1770000000,
        endTime: 1770003600,
      });

      expect(result).toEqual(mockUpdateTimeResult);
    });

    it('should pass id and DTO to service', async () => {
      service.updateTime.mockResolvedValue(mockUpdateTimeResult);
      const dto = { startTime: 1770000000, endTime: 1770003600 };

      await controller.updateTime(5, dto);

      expect(service.updateTime).toHaveBeenCalledWith(5, dto);
    });

    it('should propagate BadRequestException from service', async () => {
      service.updateTime.mockRejectedValue(
        new BadRequestException(
          'endTime must be greater than or equal to startTime.',
        ),
      );

      await expect(
        controller.updateTime(1, {
          startTime: 1770003600,
          endTime: 1770000000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from service', async () => {
      service.updateTime.mockRejectedValue(
        new NotFoundException('InterviewCandidate #999 not found.'),
      );

      await expect(
        controller.updateTime(999, { startTime: 1770000000 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should call service.remove with correct id', async () => {
      service.remove.mockResolvedValue(undefined);

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
      service.remove.mockResolvedValue(undefined);

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
