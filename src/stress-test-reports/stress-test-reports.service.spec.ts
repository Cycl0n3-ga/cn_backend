import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { StressTestReportsService } from './stress-test-reports.service.js';

describe('StressTestReportsService', () => {
  let service: StressTestReportsService;
  let prisma: {
    stressTestReport: {
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
  };

  const mockPrismaService = {
    stressTestReport: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
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

  it('should fetch reports with descending order and limit', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    mockPrismaService.stressTestReport.findMany.mockResolvedValueOnce([
      {
        id: 'r1',
        testName: 'stress-1',
        endpoint: '/api/problems',
        method: 'GET',
        connections: 10,
        duration: 30,
        totalRequests: 100,
        successfulReqs: 98,
        failedReqs: 2,
        errors: 0,
        timeouts: 0,
        avgLatencyMs: 20,
        p50LatencyMs: 15,
        p99LatencyMs: 80,
        maxLatencyMs: 100,
        avgThroughput: 200,
        statusCodes: '{"200":98,"500":2}',
        assessment: 'PASSED',
        assessmentMsg: 'ok',
        createdAt,
      },
    ]);

    const result = await service.getReports('/api/problems', 10);

    expect(prisma.stressTestReport.findMany).toHaveBeenCalledWith({
      where: { endpoint: '/api/problems' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'r1',
        endpoint: '/api/problems',
        createdAt,
      }),
    ]);
  });
});
