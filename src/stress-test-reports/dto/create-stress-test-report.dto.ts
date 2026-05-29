import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateStressTestReportDto {
  @IsString()
  testName: string;

  @IsString()
  endpoint: string;

  @IsString()
  @IsOptional()
  method?: string = 'GET';

  @IsNumber()
  @Min(1)
  connections: number;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsNumber()
  @Min(0)
  totalRequests: number;

  @IsNumber()
  @Min(0)
  successfulReqs: number;

  @IsNumber()
  @Min(0)
  failedReqs: number;

  @IsNumber()
  @Min(0)
  errors: number;

  @IsNumber()
  @Min(0)
  timeouts: number;

  @IsNumber()
  @Min(0)
  avgLatencyMs: number;

  @IsNumber()
  @Min(0)
  p50LatencyMs: number;

  @IsNumber()
  @Min(0)
  p99LatencyMs: number;

  @IsNumber()
  @Min(0)
  maxLatencyMs: number;

  @IsNumber()
  @Min(0)
  avgThroughput: number;

  @IsString()
  statusCodes: string; // JSON string

  @IsString()
  @IsOptional()
  assessment?: string;

  @IsString()
  @IsOptional()
  assessmentMsg?: string;
}

export class StressTestReportDto {
  id: string;
  testName: string;
  endpoint: string;
  method: string;
  connections: number;
  duration: number;
  totalRequests: number;
  successfulReqs: number;
  failedReqs: number;
  errors: number;
  timeouts: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  avgThroughput: number;
  statusCodes: string;
  assessment: string;
  assessmentMsg: string;
  createdAt: Date;
}

export class StressTestSummaryDto {
  endpoint: string;
  latestReportAt: Date;
  reportsCount: number;
  avgSuccessRate: number;
  avgP99Latency: number;
  overallAssessment: string;
}
