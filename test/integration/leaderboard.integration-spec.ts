import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardModule } from '../../src/leaderboard/leaderboard.module';
import { LeaderboardService } from '../../src/leaderboard/leaderboard.service';

describe('LeaderboardService (integration)', () => {
  let moduleRef: TestingModule;
  let leaderboardService: LeaderboardService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [LeaderboardModule],
    }).compile();

    leaderboardService = moduleRef.get(LeaderboardService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('getRankings should return seeded rankings in correct order (bob should be #1)', async () => {
    const res = await leaderboardService.getRankings(1, 20);

    expect(res.total).toBe('2');
    expect(res.page).toBe('1');
    expect(res.data.length).toBeGreaterThan(0);

    expect(res.data[0]).toEqual(
      expect.objectContaining({
        rank: '1',
        username: 'bob',
      }),
    );

    for (const item of res.data) {
      expect(typeof item.rank).toBe('string');
      expect(typeof item.solved_count).toBe('string');
      expect(typeof item.rating).toBe('string');
    }
  });
});
