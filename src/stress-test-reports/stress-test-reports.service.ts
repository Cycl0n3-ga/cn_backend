import { Injectable } from '@nestjs/common';
import { StressTestReport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStressTestReportDto, StressTestReportDto, StressTestSummaryDto } from './dto/create-stress-test-report.dto';

@Injectable()
export class StressTestReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(dto: CreateStressTestReportDto): Promise<StressTestReportDto> {
    const report = await this.prisma.stressTestReport.create({
      data: {
        testName: dto.testName,
        endpoint: dto.endpoint,
        method: dto.method || 'GET',
        connections: dto.connections,
        duration: dto.duration,
        totalRequests: dto.totalRequests,
        successfulReqs: dto.successfulReqs,
        failedReqs: dto.failedReqs,
        errors: dto.errors,
        timeouts: dto.timeouts,
        avgLatencyMs: dto.avgLatencyMs,
        p50LatencyMs: dto.p50LatencyMs,
        p99LatencyMs: dto.p99LatencyMs,
        maxLatencyMs: dto.maxLatencyMs,
        avgThroughput: dto.avgThroughput,
        statusCodes: dto.statusCodes,
        assessment: dto.assessment || this.calculateAssessment(dto),
        assessmentMsg: dto.assessmentMsg || this.generateAssessmentMsg(dto),
      },
    });

    return this.mapToDto(report);
  }

  async getReports(endpoint?: string, limit: number = 50): Promise<StressTestReportDto[]> {
    const where = endpoint ? { endpoint } : {};

    const reports = await this.prisma.stressTestReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return reports.map(r => this.mapToDto(r));
  }

  async getLatestReport(endpoint: string): Promise<StressTestReportDto | null> {
    const report = await this.prisma.stressTestReport.findFirst({
      where: { endpoint },
      orderBy: { createdAt: 'desc' },
    });

    return report ? this.mapToDto(report) : null;
  }

  async getSummary(endpoint?: string): Promise<StressTestSummaryDto[]> {
    const where = endpoint ? { endpoint } : {};

    // Group by endpoint and calculate aggregates
    const reports = await this.prisma.stressTestReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const grouped = new Map<string, StressTestReport[]>();
    reports.forEach(r => {
      if (!grouped.has(r.endpoint)) {
        grouped.set(r.endpoint, []);
      }
      grouped.get(r.endpoint)!.push(r);
    });

    const summaries: StressTestSummaryDto[] = [];

    for (const [ep, epReports] of grouped) {
      const latestReport = epReports[0];
      const avgSuccessRate = epReports.length > 0
        ? (epReports.reduce((sum, r) => sum + (r.totalRequests > 0 ? (r.successfulReqs / r.totalRequests) * 100 : 0), 0) / epReports.length)
        : 0;
      const avgP99Latency = epReports.length > 0
        ? epReports.reduce((sum, r) => sum + r.p99LatencyMs, 0) / epReports.length
        : 0;

      summaries.push({
        endpoint: ep,
        latestReportAt: latestReport.createdAt,
        reportsCount: epReports.length,
        avgSuccessRate,
        avgP99Latency,
        overallAssessment: this.determineOverallAssessment(epReports),
      });
    }

    return summaries;
  }

  private calculateAssessment(dto: CreateStressTestReportDto): string {
    const successRate = dto.totalRequests > 0 ? (dto.successfulReqs / dto.totalRequests) * 100 : 0;

    if (successRate >= 95 && dto.p99LatencyMs <= 1000 && dto.timeouts === 0) {
      return 'PASSED';
    }

    if (successRate >= 80 || (dto.p99LatencyMs <= 1500 && dto.timeouts < 10)) {
      return 'WARNING';
    }

    return 'FAILED';
  }

  private generateAssessmentMsg(dto: CreateStressTestReportDto): string {
    const issues: string[] = [];

    if (dto.p99LatencyMs > 1000) {
      issues.push(`P99 延遲過高: ${dto.p99LatencyMs}ms > 1000ms`);
    }

    if (dto.errors > 0) {
      issues.push(`連接錯誤: ${dto.errors} 個`);
    }

    if (dto.timeouts > 0) {
      issues.push(`超時: ${dto.timeouts} 個`);
    }

    const successRate = dto.totalRequests > 0 ? (dto.successfulReqs / dto.totalRequests) * 100 : 0;
    if (successRate < 80) {
      issues.push(`成功率過低: ${successRate.toFixed(2)}% < 80%`);
    }

    if (issues.length === 0) {
      return '✅ 所有指標均在可接受範圍內';
    }

    return issues.join(' | ');
  }

  private determineOverallAssessment(reportList: StressTestReport[]): string {
    if (reportList.length === 0) return 'NO_DATA';

    const passCount = reportList.filter(r => r.assessment === 'PASSED').length;
    const failedCount = reportList.filter(r => r.assessment === 'FAILED').length;

    const passRate = (passCount / reportList.length) * 100;

    if (passRate >= 80) return 'HEALTHY';
    if (passRate >= 50) return 'DEGRADED';
    return 'CRITICAL';
  }

  private mapToDto(report: any): StressTestReportDto {
    return {
      id: report.id,
      testName: report.testName,
      endpoint: report.endpoint,
      method: report.method,
      connections: report.connections,
      duration: report.duration,
      totalRequests: report.totalRequests,
      successfulReqs: report.successfulReqs,
      failedReqs: report.failedReqs,
      errors: report.errors,
      timeouts: report.timeouts,
      avgLatencyMs: report.avgLatencyMs,
      p50LatencyMs: report.p50LatencyMs,
      p99LatencyMs: report.p99LatencyMs,
      maxLatencyMs: report.maxLatencyMs,
      avgThroughput: report.avgThroughput,
      statusCodes: report.statusCodes,
      assessment: report.assessment,
      assessmentMsg: report.assessmentMsg,
      createdAt: report.createdAt,
    };
  }
}
