import { Controller, Get, Post, Body, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StressTestReportsService } from './stress-test-reports.service.js';
import { CreateStressTestReportDto, StressTestReportDto, StressTestSummaryDto } from './dto/create-stress-test-report.dto.js';

@Controller('stress-test-reports')
export class StressTestReportsController {
  constructor(private readonly service: StressTestReportsService) {}

  @Post()
  async createReport(@Body() dto: CreateStressTestReportDto): Promise<StressTestReportDto> {
    return this.service.createReport(dto);
  }

  @Get()
  async getReports(
    @Query('endpoint') endpoint?: string,
    @Query('limit') limit: string = '50',
  ): Promise<StressTestReportDto[]> {
    return this.service.getReports(endpoint, parseInt(limit, 10));
  }

  @Get('latest')
  async getLatestReport(@Query('endpoint') endpoint: string): Promise<StressTestReportDto | null> {
    if (!endpoint) {
      return null;
    }
    return this.service.getLatestReport(endpoint);
  }

  @Get('summary')
  async getSummary(@Query('endpoint') endpoint?: string): Promise<StressTestSummaryDto[]> {
    return this.service.getSummary(endpoint);
  }

  @Get('dashboard')
  async getDashboard(@Res() res: Response): Promise<void> {
    const summaries = await this.service.getSummary();
    const recentReports = await this.service.getReports(undefined, 100);

    const html = this.generateDashboardHTML(summaries, recentReports);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  private generateDashboardHTML(summaries: StressTestSummaryDto[], reports: StressTestReportDto[]): string {
    const healthStatus = (status: string) => {
      const colors = {
        HEALTHY: '#22c55e',
        DEGRADED: '#f59e0b',
        CRITICAL: '#ef4444',
        NO_DATA: '#9ca3af',
      };
      return colors[status] || '#9ca3af';
    };

    const assessmentIcon = (assessment: string) => {
      const icons = {
        PASSED: '✅',
        WARNING: '⚠️',
        FAILED: '🔴',
      };
      return icons[assessment] || '❓';
    };

    const summaryCards = summaries
      .map(
        s => `
      <div class="card">
        <div class="card-header">
          <h3>${s.endpoint}</h3>
          <span class="badge" style="background-color: ${healthStatus(s.overallAssessment)}">
            ${s.overallAssessment}
          </span>
        </div>
        <div class="card-body">
          <p><strong>成功率:</strong> ${s.avgSuccessRate.toFixed(2)}%</p>
          <p><strong>平均 P99 延遲:</strong> ${s.avgP99Latency.toFixed(2)}ms</p>
          <p><strong>報告數量:</strong> ${s.reportsCount}</p>
          <p><strong>最新報告時間:</strong> ${new Date(s.latestReportAt).toLocaleString('zh-TW')}</p>
        </div>
      </div>
    `,
      )
      .join('');

    const reportTable = reports
      .slice(0, 50)
      .map(
        r => `
      <tr>
        <td>${r.testName}</td>
        <td>${r.endpoint}</td>
        <td>${r.connections}</td>
        <td>${r.totalRequests}</td>
        <td>${r.successfulReqs}</td>
        <td>${((r.successfulReqs / r.totalRequests) * 100).toFixed(2)}%</td>
        <td>${r.p99LatencyMs.toFixed(2)}ms</td>
        <td>${r.avgThroughput.toFixed(2)}</td>
        <td>${r.errors}</td>
        <td>${r.timeouts}</td>
        <td>${assessmentIcon(r.assessment)} ${r.assessment}</td>
        <td>${new Date(r.createdAt).toLocaleString('zh-TW')}</td>
      </tr>
    `,
      )
      .join('');

    return `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>系統壓力測試 Dashboard</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        header {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 30px;
        }

        header h1 {
          color: #1f2937;
          margin-bottom: 5px;
          font-size: 32px;
        }

        header p {
          color: #6b7280;
          font-size: 14px;
        }

        .summary-section {
          margin-bottom: 40px;
        }

        .summary-section h2 {
          color: white;
          margin-bottom: 20px;
          font-size: 24px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .card {
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .card-header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-header h3 {
          color: #1f2937;
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .badge {
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .card-body {
          padding: 20px;
        }

        .card-body p {
          margin: 10px 0;
          color: #374151;
          font-size: 14px;
        }

        .card-body strong {
          color: #1f2937;
        }

        .reports-section {
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .reports-section h2 {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
          font-size: 20px;
          margin: 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          overflow-x: auto;
          display: block;
        }

        thead {
          background: #f3f4f6;
        }

        th {
          padding: 12px;
          text-align: left;
          color: #374151;
          font-weight: 600;
          font-size: 13px;
          border-bottom: 2px solid #e5e7eb;
          white-space: nowrap;
        }

        td {
          padding: 12px;
          color: #6b7280;
          font-size: 13px;
          border-bottom: 1px solid #e5e7eb;
        }

        tbody tr:hover {
          background: #f9fafb;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .metric-good {
          color: #22c55e;
          font-weight: 600;
        }

        .metric-warning {
          color: #f59e0b;
          font-weight: 600;
        }

        .metric-bad {
          color: #ef4444;
          font-weight: 600;
        }

        footer {
          text-align: center;
          color: white;
          margin-top: 30px;
          font-size: 12px;
        }

        @media (max-width: 768px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }

          table {
            font-size: 11px;
          }

          th, td {
            padding: 8px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>🚀 系統壓力測試 Dashboard</h1>
          <p>實時監控系統在不同負載下的性能表現</p>
        </header>

        <div class="summary-section">
          <h2>📊 端點健康狀況概覽</h2>
          <div class="cards-grid">
            ${summaryCards || '<p style="color: white;">暫無數據</p>'}
          </div>
        </div>

        <div class="reports-section">
          <h2>📋 最近的壓力測試報告 (前 50 個)</h2>
          <table>
            <thead>
              <tr>
                <th>測試名稱</th>
                <th>端點</th>
                <th>並發連接</th>
                <th>總請求</th>
                <th>成功請求</th>
                <th>成功率</th>
                <th>P99 延遲</th>
                <th>吞吐量(req/s)</th>
                <th>錯誤</th>
                <th>超時</th>
                <th>評估</th>
                <th>時間</th>
              </tr>
            </thead>
            <tbody>
              ${reportTable || '<tr><td colspan="12" style="text-align: center;">暫無數據</td></tr>'}
            </tbody>
          </table>
        </div>

        <footer>
          <p>更新於: ${new Date().toLocaleString('zh-TW')} | 系統壓力測試監控系統 v1.0</p>
        </footer>
      </div>
    </body>
    </html>
    `;
  }
}
