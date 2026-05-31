import { Test, TestingModule } from '@nestjs/testing';
import { JudgeQueueService } from './judge-queue.service.js';
import { JudgeService } from './judge.service.js';

describe('JudgeQueueService', () => {
  let service: JudgeQueueService;
  let judgeService: jest.Mocked<JudgeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JudgeQueueService,
        {
          provide: JudgeService,
          useValue: {
            run: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JudgeQueueService>(JudgeQueueService);
    judgeService = module.get(JudgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue and execute tasks', async () => {
    judgeService.run.mockResolvedValueOnce({
      status: 'ACCEPTED',
      executionTimeMs: 10,
      score: 100,
      expectedOutput: '',
      stdout: '',
      stderr: '',
    });

    const result = await service.enqueue({
      code: 'console.log("Hello")',
      language: 'javascript',
      input: '',
      expectedOutput: '',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(judgeService.run).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during execution', async () => {
    judgeService.run.mockRejectedValueOnce(new Error('Test error'));

    await expect(
      service.enqueue({
        code: 'console.log("Hello")',
        language: 'javascript',
        input: '',
        expectedOutput: '',
      }),
    ).rejects.toThrow('Test error');
  });

  it('should return correct stats', () => {
    const stats = service.getStats();
    expect(stats).toHaveProperty('active', 0);
    expect(stats).toHaveProperty('queued', 0);
    expect(stats).toHaveProperty('concurrency');
  });
});
