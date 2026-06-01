import { Test, TestingModule } from '@nestjs/testing';
import { JudgeJobProcessor } from './judge-job.processor.js';
import { JudgeQueueService } from './judge-queue.service.js';

describe('JudgeQueueService', () => {
  let service: JudgeQueueService;
  let processor: jest.Mocked<JudgeJobProcessor>;

  beforeEach(async () => {
    process.env.JUDGE_QUEUE_DRIVER = 'inline';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JudgeQueueService,
        {
          provide: JudgeJobProcessor,
          useValue: {
            processSubmission: jest.fn().mockResolvedValue(undefined),
            runSample: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JudgeQueueService>(JudgeQueueService);
    processor = module.get(JudgeJobProcessor);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue submission jobs in inline mode', async () => {
    const result = await service.enqueueSubmission('sub-uuid-1');

    expect(result).toEqual({
      jobId: 'inline:sub-uuid-1',
      driver: 'inline',
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(processor.processSubmission).toHaveBeenCalledWith('sub-uuid-1', {
      jobId: 'inline:sub-uuid-1',
      attempt: 1,
    });
  });

  it('should run sample jobs in inline mode', async () => {
    processor.runSample.mockResolvedValueOnce({
      status: 'ACCEPTED',
      executionTimeMs: 10,
      score: 100,
      expectedOutput: '',
      stdout: '',
      stderr: '',
    });

    const result = await service.runSample({
      code: 'console.log("Hello")',
      language: 'javascript',
      input: '',
      expectedOutput: '',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(processor.runSample).toHaveBeenCalledTimes(1);
  });

  it('should return correct stats', async () => {
    const stats = await service.getStats();
    expect(stats).toMatchObject({
      driver: 'inline',
      active: 0,
      waiting: 0,
      failed: 0,
    });
  });
});
