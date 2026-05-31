import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AssignmentsController', () => {
  let controller: AssignmentsController;
  let service: jest.Mocked<AssignmentsService>;

  const mockAssignment = {
    id: '1',
    jobId: '1',
    userId: 'user-uuid-1',
    problemId: '1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    interview: {
      id: '1',
      jobRole: 'Backend Developer',
      examinerEmpId: 'examiner-uuid',
    },
    problem: { id: 1, title: 'Two Sum', difficulty: 'EASY' },
    user: { id: 'user-uuid-1', username: 'alice', role: 'CANDIDATE' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        {
          provide: AssignmentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByUser: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AssignmentsController>(AssignmentsController);
    service = module.get(AssignmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── create ─────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create an assignment and return result', async () => {
      service.create.mockResolvedValue(mockAssignment);

      const result = await controller.create({
        jobId: 1,
        userId: 'user-uuid-1',
        problemId: 1,
      });

      expect(result).toEqual(mockAssignment);
    });

    it('should pass DTO directly to service', async () => {
      service.create.mockResolvedValue(mockAssignment);
      const dto = { jobId: 2, userId: 'user-uuid-2', problemId: 3 };

      await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should propagate NotFoundException when interview not found', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Interview #999 not found.'),
      );

      await expect(
        controller.create({ jobId: 999, userId: 'uid', problemId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when user not found', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('User #nonexistent not found.'),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'nonexistent', problemId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate NotFoundException when problem not found', async () => {
      service.create.mockRejectedValue(
        new NotFoundException('Problem #999 not found.'),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'uid', problemId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate ConflictException for duplicate assignment', async () => {
      service.create.mockRejectedValue(
        new ConflictException(
          'This problem is already assigned to the user in this interview.',
        ),
      );

      await expect(
        controller.create({ jobId: 1, userId: 'uid', problemId: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── findAll ────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all assignments', async () => {
      service.findAll.mockResolvedValue([mockAssignment]);

      const result = await controller.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no assignments exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it('should call service.findAll without arguments', async () => {
      service.findAll.mockResolvedValue([]);

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith();
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return a single assignment', async () => {
      service.findOne.mockResolvedValue(mockAssignment);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockAssignment);
    });

    it('should pass ID to service', async () => {
      service.findOne.mockResolvedValue(mockAssignment);

      await controller.findOne(42);

      expect(service.findOne).toHaveBeenCalledWith(42);
    });

    it('should propagate NotFoundException for non-existent assignment', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Assignment #999 not found.'),
      );

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByUser ─────────────────────────────────────────────────────────
  describe('findByUser', () => {
    it('should return assignments for a user', async () => {
      service.findByUser.mockResolvedValue([mockAssignment]);

      const result = await controller.findByUser('user-uuid-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].userId).toBe('user-uuid-1');
    });

    it('should pass userId to service', async () => {
      service.findByUser.mockResolvedValue([]);

      await controller.findByUser('specific-user-id');

      expect(service.findByUser).toHaveBeenCalledWith('specific-user-id');
    });

    it('should return empty array when user has no assignments', async () => {
      service.findByUser.mockResolvedValue([]);

      const result = await controller.findByUser('uid-no-assignments');

      expect(result).toEqual([]);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should call service.remove with correct id', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it('should not throw for existing assignment', async () => {
      service.remove.mockResolvedValue(undefined);

      await expect(controller.remove(1)).resolves.not.toThrow();
    });

    it('should propagate NotFoundException for non-existent assignment', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Assignment #999 not found.'),
      );

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should propagate error message correctly', async () => {
      service.remove.mockRejectedValue(
        new NotFoundException('Assignment #33 not found.'),
      );

      await expect(controller.remove(33)).rejects.toThrow(
        'Assignment #33 not found.',
      );
    });
  });
});
