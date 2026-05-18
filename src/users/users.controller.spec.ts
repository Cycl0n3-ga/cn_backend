import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockFindAllResult = {
    data: [
      {
        id: 'uuid-1',
        username: 'alice',
        email: 'alice@example.com',
        role: 'USER',
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
    it('should return all users', async () => {
      service.findAll.mockResolvedValue(mockFindAllResult as any);

      const result = await controller.findAll();

      expect(result).toEqual(mockFindAllResult);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty data array when no users', async () => {
      service.findAll.mockResolvedValue({ data: [] } as any);

      const result = await controller.findAll();

      expect(result.data).toHaveLength(0);
    });
  });

  // ── getSubmissions ────────────────────────────────────────────────────
  describe('getSubmissions', () => {
    it('should return submission history with default pagination', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult as any);

      const result = await controller.getSubmissions('alice');

      expect(result).toEqual(mockHistoryResult);
      expect(service.getSubmissionHistory).toHaveBeenCalledWith('alice', 1, 20);
    });

    it('should pass custom page and limit to service', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult as any);

      await controller.getSubmissions('alice', '2', '10');

      expect(service.getSubmissionHistory).toHaveBeenCalledWith('alice', 2, 10);
    });

    it('should convert string page/limit to numbers', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult as any);

      await controller.getSubmissions('alice', '3', '5');

      const call = service.getSubmissionHistory.mock.calls[0];
      expect(typeof call[1]).toBe('number');
      expect(typeof call[2]).toBe('number');
      expect(call[1]).toBe(3);
      expect(call[2]).toBe(5);
    });

    it('should propagate NotFoundException for unknown username', async () => {
      service.getSubmissionHistory.mockRejectedValue(
        new NotFoundException('User "ghost" not found.'),
      );

      await expect(controller.getSubmissions('ghost')).rejects.toThrow(NotFoundException);
    });

    it('should use page=1 when page query param is not provided', async () => {
      service.getSubmissionHistory.mockResolvedValue(mockHistoryResult as any);

      await controller.getSubmissions('alice', undefined, undefined);

      expect(service.getSubmissionHistory).toHaveBeenCalledWith('alice', 1, 20);
    });
  });
});
