import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn().mockResolvedValue(3),
      },
      submission: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
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
      // ISO 8601 format check
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
      // submission.count still may work or fail gracefully
      prisma.submission.count.mockResolvedValue(0);

      const result = await controller.check();

      expect(result.status).toBe('DOWN');
      expect(result.services.database).toBe('DOWN');
    });
  });
});
