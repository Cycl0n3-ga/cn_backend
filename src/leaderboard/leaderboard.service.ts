import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole } from '../auth/user-role.js';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getRankings(page = 1, limit = 20) {
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CANDIDATE } }),
      this.prisma.user.findMany({
        where: { role: UserRole.CANDIDATE },
        select: {
          username: true,
          solvedCount: true,
          rating: true,
        },
        orderBy: [{ rating: 'desc' }, { solvedCount: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const offset = (page - 1) * limit;
    const rankings = users.map((u, i) => ({
      rank: (offset + i + 1).toString(),
      username: u.username,
      solved_count: u.solvedCount.toString(),
      rating: u.rating.toString(),
    }));

    return {
      total: total.toString(),
      page: page.toString(),
      data: rankings,
    };
  }
}
