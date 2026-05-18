import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let service: jest.Mocked<LeaderboardService>;

  const mockRankingsResult = {
    total: '100',
    page: '1',
    data: [
      { rank: '1', username: 'bob', solved_count: '5', rating: '1800' },
      { rank: '2', username: 'alice', solved_count: '3', rating: '1500' },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        {
          provide: LeaderboardService,
          useValue: {
            getRankings: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    service = module.get(LeaderboardService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── getRankings ───────────────────────────────────────────────────────
  describe('getRankings', () => {
    it('should return rankings data', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      const result = await controller.getRankings('1', '10');

      expect(result).toEqual(mockRankingsResult);
    });

    it('should convert string page and limit to numbers', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      await controller.getRankings('3', '15');

      expect(service.getRankings).toHaveBeenCalledWith(3, 15);
    });

    it('should default page to 1 when not provided', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      await controller.getRankings(undefined, undefined);

      expect(service.getRankings).toHaveBeenCalledWith(1, 20);
    });

    it('should default limit to 20 when not provided', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      await controller.getRankings('2', undefined);

      expect(service.getRankings).toHaveBeenCalledWith(2, 20);
    });

    it('should return total as string', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      const result = await controller.getRankings('1', '10');

      expect(typeof result.total).toBe('string');
    });

    it('should return data array', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      const result = await controller.getRankings('1', '10');

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return all required ranking fields', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      const result = await controller.getRankings('1', '10');

      expect(result.data[0]).toHaveProperty('rank');
      expect(result.data[0]).toHaveProperty('username');
      expect(result.data[0]).toHaveProperty('solved_count');
      expect(result.data[0]).toHaveProperty('rating');
    });

    it('should handle page=1 limit=10 correctly', async () => {
      service.getRankings.mockResolvedValue(mockRankingsResult as any);

      await controller.getRankings('1', '10');

      expect(service.getRankings).toHaveBeenCalledWith(1, 10);
    });
  });
});
