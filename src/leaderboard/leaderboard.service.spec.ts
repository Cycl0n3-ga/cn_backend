import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  // ── getRankings ───────────────────────────────────────────────────────
  describe('getRankings', () => {
    it('should return paginated rankings sorted by rating desc', async () => {
      prisma.user.count.mockResolvedValue(2);
      prisma.user.findMany.mockResolvedValue([
        { username: 'bob', solvedCount: 5, rating: 1800 },
        { username: 'alice', solvedCount: 3, rating: 1500 },
      ]);

      const result = await service.getRankings(1, 20);

      expect(result.total).toBe('2');
      expect(result.page).toBe('1');
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        rank: '1',
        username: 'bob',
        solved_count: '5',
        rating: '1800',
      });
      expect(result.data[1]).toEqual({
        rank: '2',
        username: 'alice',
        solved_count: '3',
        rating: '1500',
      });
    });

    it('should return all numeric values as strings', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([
        { username: 'alice', solvedCount: 3, rating: 1500 },
      ]);

      const result = await service.getRankings(1, 20);

      expect(typeof result.total).toBe('string');
      expect(typeof result.page).toBe('string');
      expect(typeof result.data[0].rank).toBe('string');
      expect(typeof result.data[0].solved_count).toBe('string');
      expect(typeof result.data[0].rating).toBe('string');
    });

    it('should calculate correct ranks for page 2', async () => {
      prisma.user.count.mockResolvedValue(25);
      prisma.user.findMany.mockResolvedValue([
        { username: 'user21', solvedCount: 1, rating: 100 },
      ]);

      const result = await service.getRankings(2, 20);

      expect(result.data[0].rank).toBe('21');
      expect(result.page).toBe('2');
    });

    it('should calculate correct offset for page 3, limit 5', async () => {
      prisma.user.count.mockResolvedValue(20);
      prisma.user.findMany.mockResolvedValue([
        { username: 'user11', solvedCount: 1, rating: 100 },
      ]);

      const result = await service.getRankings(3, 5);

      expect(result.data[0].rank).toBe('11'); // (3-1)*5 + 1
    });

    it('should only count USER role (not ADMIN)', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getRankings();

      expect(prisma.user.count).toHaveBeenCalledWith({ where: { role: 'USER' } });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'USER' } }),
      );
    });

    it('should apply correct pagination skip/take', async () => {
      prisma.user.count.mockResolvedValue(100);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getRankings(3, 10);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('should return empty data array when no users', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getRankings();

      expect(result.total).toBe('0');
      expect(result.data).toHaveLength(0);
    });

    it('should default page to 1 and limit to 20', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await service.getRankings();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });
});
