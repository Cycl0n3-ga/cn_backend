import { Test, TestingModule } from '@nestjs/testing';
import { StressTestReportsController } from './stress-test-reports.controller.js';
import { StressTestReportsService } from './stress-test-reports.service.js';

describe('StressTestReportsController', () => {
  let controller: StressTestReportsController;
  let service: jest.Mocked<StressTestReportsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StressTestReportsController],
      providers: [
        {
          provide: StressTestReportsService,
          useValue: {
            createReport: jest.fn(),
            getReports: jest.fn(),
            getLatestReport: jest.fn(),
            getSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StressTestReportsController>(
      StressTestReportsController,
    );
    service = module.get(StressTestReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fallback to default limit when query limit is invalid', async () => {
    service.getReports.mockResolvedValue([]);

    await controller.getReports('/api/problems', 'abc');

    expect(service.getReports).toHaveBeenCalledWith('/api/problems', 50);
  });

  it('should clamp query limit to 100 when value is too large', async () => {
    service.getReports.mockResolvedValue([]);

    await controller.getReports('/api/problems', '999');

    expect(service.getReports).toHaveBeenCalledWith('/api/problems', 100);
  });
});
