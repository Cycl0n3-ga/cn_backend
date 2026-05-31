import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockFindAllResult = {
    total: '1',
    page: '1',
    data: [
      {
        id: 'uuid-1',
        username: 'alice',
        email: null as string | null,
        role: 'CANDIDATE',
        solvedCount: '3',
        rating: '1500',
        createdAt: new Date(),
      },
    ],
  };

  const mockHistoryResult = {
    total: '2',
    page: '1',
    data: [
      {
        submission_id: 'sub-1',
        problem_id: '1',
        language: 'python3',
        status: 'ACCEPTED',
        score: '100',
        source_code: 'pass',
        execution_result: '[0,1]',
        submitted_at: new Date(),
      },
    ],
  };

  const mockAdminReq = { user: { username: 'admin', role: 'ADMIN' } };
  const mockAliceReq = { user: { username: 'alice', role: 'CANDIDATE' } };
  const mockBobReq = { user: { username: 'bob', role: 'CANDIDATE' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
            getSubmissionHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all users with pagination', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult);

      const result = await controller.findAll();

      expect(result).toEqual(mockFindAllResult);
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('should pass custom page and limit', async () => {
      service.findAll.mockResolvedValue({ total: '0', page: '2', data: [] });

      await controller.findAll('2', '10');

      expect(service.findAll).toHaveBeenCalledWith(2, 10);
    });

    it('should clamp limit to max 100', async () => {
      service.findAll.mockResolvedValue({ total: '0', page: '1', data: [] });

      await controller.findAll('1', '999');

      expect(service.findAll).toHaveBeenCalledWith(1, 100);
    });
  });

  // ── getSubmissions ────────────────────────────────────────────────────
  describe('getSubmissions', () => {
    it('should return submission history for own user', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult);

      const result = await controller.getSubmissions(mockAliceReq, 'alice');

      expect(result).toEqual(mockHistoryResult);
      expect(service.getSubmissionHistory).toHaveBeenCalledWith('alice', 1, 20);
    });

    it('should allow ADMIN to view any user submissions', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult);

      const result = await controller.getSubmissions(
        mockAdminReq,
        'alice',
        '2',
        '10',
      );

      expect(result).toEqual(mockHistoryResult);
      expect(service.getSubmissionHistory).toHaveBeenCalledWith('alice', 2, 10);
    });

    it('should throw ForbiddenException when viewing other user submissions', () => {
      expect(() => controller.getSubmissions(mockBobReq, 'alice')).toThrow(
        ForbiddenException,
      );
    });

    it('should propagate NotFoundException for unknown username', async () => {
      service.getSubmissionHistory.mockRejectedValue(
        new NotFoundException('User "ghost" not found.'),
      );

      await expect(
        controller.getSubmissions(mockAdminReq, 'ghost'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use page=1 when page query param is not provided', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult);

      await controller.getSubmissions(
        mockAliceReq,
        'alice',
        undefined,
        undefined,
      );

      expect(service.getSubmissionHistory).toHaveBeenCalledWith('alice', 1, 20);
    });
  });
});
