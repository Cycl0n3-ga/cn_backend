import { Injectable } from '@nestjs/common';
import { StressTestReport } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateStressTestReportDto,
  StressTestReportDto,
  StressTestSummaryDto,
} from './dto/create-stress-test-report.dto.js';

@Injectable()
export class StressTestReportsService {
  constructor(private prisma: PrismaService) {}

  async createReport(
    dto: CreateStressTestReportDto,
  ): Promise<StressTestReportDto> {
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

  async getReports(
    endpoint?: string,
    limit: number = 50,
  ): Promise<StressTestReportDto[]> {
    const where = endpoint ? { endpoint } : {};

    const reports = await this.prisma.stressTestReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return reports.map((r) => this.mapToDto(r));
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

    const reports = await this.prisma.stressTestReport.groupBy({
      by: ['endpoint'],
      where,
      _count: { _all: true },
      _avg: {
        p99LatencyMs: true,
      },
      _sum: {
        successfulReqs: true,
        totalRequests: true,
      },
      _max: {
        createdAt: true,
      },
    });
    const assessments = await this.prisma.stressTestReport.groupBy({
      by: ['endpoint', 'assessment'],
      where,
      _count: { _all: true },
    });
    const assessmentMap = new Map<
      string,
      {
        total: number;
        passed: number;
      }
    >();

    assessments.forEach((item) => {
      const current = assessmentMap.get(item.endpoint) ?? {
        total: 0,
        passed: 0,
      };
      current.total += item._count._all;
      if (item.assessment === 'PASSED') {
        current.passed += item._count._all;
      }
      assessmentMap.set(item.endpoint, current);
    });

    return reports.map((report) => {
      const successfulReqs = report._sum.successfulReqs ?? 0;
      const totalRequests = report._sum.totalRequests ?? 0;
      const avgSuccessRate =
        totalRequests > 0 ? (successfulReqs / totalRequests) * 100 : 0;
      const assessment = assessmentMap.get(report.endpoint) ?? {
        total: 0,
        passed: 0,
      };

      return {
        endpoint: report.endpoint,
        latestReportAt: report._max.createdAt ?? new Date(0),
        reportsCount: report._count._all,
        avgSuccessRate,
        avgP99Latency: report._avg.p99LatencyMs ?? 0,
        overallAssessment: this.determineOverallAssessment(
          assessment.passed,
          assessment.total,
        ),
      };
    });
  }

  private calculateAssessment(dto: CreateStressTestReportDto): string {
    const successRate =
      dto.totalRequests > 0
        ? (dto.successfulReqs / dto.totalRequests) * 100
        : 0;

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

    const successRate =
      dto.totalRequests > 0
        ? (dto.successfulReqs / dto.totalRequests) * 100
        : 0;
    if (successRate < 80) {
      issues.push(`成功率過低: ${successRate.toFixed(2)}% < 80%`);
    }

    if (issues.length === 0) {
      return '✅ 所有指標均在可接受範圍內';
    }

    return issues.join(' | ');
  }

  private determineOverallAssessment(
    passCount: number,
    totalCount: number,
  ): string {
    if (totalCount === 0) return 'NO_DATA';

    const passRate = (passCount / totalCount) * 100;

    if (passRate >= 80) return 'HEALTHY';
    if (passRate >= 50) return 'DEGRADED';
    return 'CRITICAL';
  }

  private mapToDto(report: StressTestReport): StressTestReportDto {
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
