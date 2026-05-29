import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { StressTestReportsService } from './stress-test-reports.service.js';

describe('StressTestReportsService', () => {
  let service: StressTestReportsService;
  let prisma: {
    stressTestReport: {
      groupBy: jest.Mock;
    };
  };

  const mockPrismaService = {
    stressTestReport: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StressTestReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StressTestReportsService>(StressTestReportsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should aggregate summary by endpoint', async () => {
    mockPrismaService.stressTestReport.groupBy
      .mockResolvedValueOnce([
        {
          endpoint: '/api/problems',
          _count: { _all: 5 },
          _avg: { p99LatencyMs: 120 },
          _sum: { successfulReqs: 450, totalRequests: 500 },
          _max: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
        },
      ])
      .mockResolvedValueOnce([
        { endpoint: '/api/problems', assessment: 'PASSED', _count: { _all: 4 } },
        { endpoint: '/api/problems', assessment: 'WARNING', _count: { _all: 1 } },
      ]);

    const result = await service.getSummary();

    expect(result).toEqual([
      {
        endpoint: '/api/problems',
        latestReportAt: new Date('2026-01-01T00:00:00.000Z'),
        reportsCount: 5,
        avgSuccessRate: 90,
        avgP99Latency: 120,
        overallAssessment: 'HEALTHY',
      },
    ]);
    expect(prisma.stressTestReport.groupBy).toHaveBeenCalledTimes(2);
  });
});
