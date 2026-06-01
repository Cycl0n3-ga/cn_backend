import { Test, TestingModule } from '@nestjs/testing';
import { JudgeQueueService } from './judge-queue.service.js';
import { JudgeRecoveryService } from './judge-recovery.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('JudgeRecoveryService', () => {
  let service: JudgeRecoveryService;
  let prisma: any;
  let queue: jest.Mocked<JudgeQueueService>;

  beforeEach(async () => {
    process.env.JUDGE_STUCK_AFTER_SECONDS = '1';
    prisma = {
      submission: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JudgeRecoveryService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JudgeQueueService,
          useValue: {
            enqueueSubmission: jest.fn().mockResolvedValue({
              jobId: 'sub-1',
              driver: 'inline',
            }),
          },
        },
      ],
    }).compile();

    service = module.get(JudgeRecoveryService);
    queue = module.get(JudgeQueueService);
  });

  it('should requeue stale pending or running submissions', async () => {
    prisma.submission.findMany.mockResolvedValue([{ id: 'sub-1' }]);

    const recovered = await service.requeueStuckSubmissions();

    expect(recovered).toBe(1);
    expect(prisma.submission.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        status: 'PENDING',
        queuedAt: expect.any(Date),
      }),
    });
    expect(queue.enqueueSubmission).toHaveBeenCalledWith('sub-1');
  });
});
