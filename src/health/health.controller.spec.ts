import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JudgeQueueService } from '../judge/judge-queue.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: any;
  let mockJudgeQueue: any;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn().mockResolvedValue(3),
      },
      submission: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      problem: {
        count: jest.fn().mockResolvedValue(2),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
    };

    mockJudgeQueue = {
      getStats: jest.fn().mockReturnValue({ active: 0, queued: 0, concurrency: 2 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: JudgeQueueService, useValue: mockJudgeQueue },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── check ─────────────────────────────────────────────────────────────
  describe('check', () => {
    it('should return UP status when database is healthy', async () => {
      const result = await controller.check();

      expect(result.status).toBe('UP');
      expect(result.services.database).toBe('OK');
    });

    it('should return all required health fields', async () => {
      const result = await controller.check();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('queue_depth');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('timestamp');
    });

    it('should include judge_queue in services', async () => {
      const result = await controller.check();

      expect(result.services).toHaveProperty('judge_queue');
    });

    it('should return queue_depth as string', async () => {
      prisma.submission.count.mockResolvedValue(5);

      const result = await controller.check();

      expect(typeof result.queue_depth).toBe('string');
      expect(result.queue_depth).toBe('5');
    });

    it('should return uptime as string ending with "s"', async () => {
      const result = await controller.check();

      expect(typeof result.uptime).toBe('string');
      expect(result.uptime).toMatch(/^\d+s$/);
    });

    it('should return timestamp as ISO 8601 string', async () => {
      const result = await controller.check();

      expect(typeof result.timestamp).toBe('string');
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should count pending/compiling/running submissions as queue_depth', async () => {
      prisma.submission.count.mockResolvedValue(3);

      const result = await controller.check();

      expect(prisma.submission.count).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING', 'COMPILING', 'RUNNING'] } },
      });
      expect(result.queue_depth).toBe('3');
    });

    it('should return DOWN status when database fails', async () => {
      prisma.user.count.mockRejectedValue(new Error('DB connection failed'));
      prisma.submission.count.mockResolvedValue(0);

      const result = await controller.check();

      expect(result.status).toBe('DOWN');
      expect(result.services.database).toBe('DOWN');
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('should return all required system stats fields', async () => {
      const result = await controller.getStats();

      expect(result).toHaveProperty('database');
      expect(result.database.status).toBe('OK');
      expect(result).toHaveProperty('counters');
      expect(result.counters.totalUsers).toBe(3);
      expect(result.counters.totalProblems).toBe(2);
      expect(result.counters.totalSubmissions).toBe(0);
      expect(result).toHaveProperty('statusCounts');
      expect(result).toHaveProperty('recentSubmissions');
      expect(result).toHaveProperty('queue');
      expect(result).toHaveProperty('system');
    });
  });

  // ── getDashboard ──────────────────────────────────────────────────────
  describe('getDashboard', () => {
    it('should return HTML string with status dashboard', () => {
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      controller.getDashboard(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Code Judge 系統監控儀表板'));
    });
  });
});
