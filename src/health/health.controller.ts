import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { JudgeQueueService } from '../judge/judge-queue.service.js';
import type { Response } from 'express';
import * as os from 'node:os';

@ApiTags('System')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeQueueService: JudgeQueueService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '系統健康檢查',
    description: '確認系統與資料庫是否正常運作',
  })
  @ApiResponse({
    status: 200,
    description: '系統狀態',
    schema: {
      example: {
        status: 'UP',
        services: { database: 'OK', judge_queue: 'OK' },
        queue_depth: '0',
        uptime: '3600s',
        timestamp: '2026-05-09T15:30:00.000Z',
      },
    },
  })
  async check() {
    return this.readiness();
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: '只確認 Node.js process 仍可回應，不檢查外部依賴。',
  })
  live() {
    return {
      status: 'UP',
      uptime: `${Math.floor((Date.now() - this.startTime) / 1000)}s`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: '確認 API 所需的 DB 與 judge queue 依賴是否可用。',
  })
  async readiness() {
    let dbStatus = 'OK';
    let pendingSubmissions = 0;
    try {
      await this.prisma.user.count();
      pendingSubmissions = await this.prisma.submission.count({
        where: { status: { in: ['PENDING', 'COMPILING', 'RUNNING'] } },
      });
    } catch {
      dbStatus = 'DOWN';
    }

    const queueReady = await this.judgeQueueService.isReady();

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: dbStatus === 'OK' && queueReady ? 'UP' : 'DOWN',
      services: {
        database: dbStatus,
        judge_queue: queueReady ? 'OK' : 'DOWN',
      },
      queue_depth: pendingSubmissions.toString(),
      uptime: `${uptimeSeconds}s`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: '獲取系統實時統計指標',
    description:
      '提供 CPU、內存、資料庫連線、判題佇列與最新提交統計，供 Dashboard 輪詢使用。',
  })
  async getStats() {
    let dbStatus = 'OK';
    let dbLatencyMs = 0;
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = 'DOWN';
    }

    const [totalUsers, totalProblems, totalSubmissions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.problem.count({ where: { isDeleted: false } }),
      this.prisma.submission.count(),
    ]);

    const statusGroups = await this.prisma.submission.groupBy({
      by: ['status'],
      _count: true,
    });
    const statusCounts = statusGroups.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const recentSubmissionsRaw = await this.prisma.submission.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true } },
      },
    });

    const recentSubmissions = recentSubmissionsRaw.map((s) => ({
      id: s.id,
      username: s.user?.username ?? 'Unknown',
      problemTitle: s.problem?.title ?? 'Unknown',
      language: s.language,
      status: s.status,
      score: s.score,
      executionTimeMs: s.executionTimeMs ?? 0,
      createdAt: s.createdAt,
    }));

    const queueStats = await this.judgeQueueService.getStats();

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const processMemoryUsage = process.memoryUsage();

    return {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      counters: {
        totalUsers,
        totalProblems,
        totalSubmissions,
      },
      statusCounts,
      recentSubmissions,
      queue: queueStats,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        cpuLoad1Min: os.loadavg()[0],
        totalMemoryBytes: totalMem,
        freeMemoryBytes: freeMem,
        processMemoryBytes: processMemoryUsage.rss,
        processHeapTotalBytes: processMemoryUsage.heapTotal,
        processHeapUsedBytes: processMemoryUsage.heapUsed,
        processUptimeSeconds: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dashboard')
  @ApiOperation({
    summary: '系統監控儀表板',
    description:
      '返回一個實時更新、視覺效果驚艷的 Glassmorphism 暗黑模式監控介面。',
  })
  getDashboard(@Res() res: Response) {
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Judge 系統監控儀表板</title>
  <!-- Google Fonts: Outfit & Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- FontAwesome Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  
  <style>
    :root {
      --bg-gradient-start: #0f0c1b;
      --bg-gradient-end: #1a0f2b;
      --panel-bg: rgba(255, 255, 255, 0.03);
      --panel-border: rgba(255, 255, 255, 0.08);
      --panel-glow: rgba(139, 92, 246, 0.15);
      
      --accent-emerald: #10b981;
      --accent-emerald-glow: rgba(16, 185, 129, 0.3);
      --accent-rose: #ef4444;
      --accent-rose-glow: rgba(239, 68, 68, 0.3);
      --accent-gold: #f59e0b;
      --accent-gold-glow: rgba(245, 158, 11, 0.3);
      --accent-cyan: #06b6d4;
      --accent-cyan-glow: rgba(6, 182, 212, 0.3);
      --accent-violet: #8b5cf6;
      --accent-violet-glow: rgba(139, 92, 246, 0.3);
      --accent-sky: #0ea5e9;
      --accent-sky-glow: rgba(14, 165, 233, 0.3);
      
      --text-primary: #f3f4f6;
      --text-secondary: #9ca3af;
      --text-muted: #6b7280;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    body {
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 24px;
      overflow-x: hidden;
    }

    .container {
      max-width: 1500px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Glassmorphic Panel Base */
    .glass-panel {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .glass-panel:hover {
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 8px 32px 0 rgba(139, 92, 246, 0.08);
    }

    /* Header styling */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      margin-bottom: 8px;
    }

    .brand h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(to right, #a78bfa, #8b5cf6, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand p {
      color: var(--text-secondary);
      font-size: 14px;
      margin-top: 4px;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .select-wrapper {
      position: relative;
    }

    .select-wrapper select {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      color: var(--text-primary);
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      padding-right: 40px;
      transition: all 0.2s;
    }

    .select-wrapper select:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .select-wrapper::after {
      content: '\\f0d7';
      font-family: 'Font Awesome 5 Free';
      font-weight: 900;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--text-secondary);
      font-size: 12px;
    }

    .btn {
      background: linear-gradient(to right, var(--accent-violet), #ec4899);
      border: none;
      border-radius: 8px;
      color: white;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
    }

    .btn:active {
      transform: translateY(1px);
    }

    /* Pulse Dot */
    .pulse-dot {
      width: 10px;
      height: 10px;
      background-color: var(--accent-emerald);
      border-radius: 50%;
      display: inline-block;
      box-shadow: 0 0 0 0 var(--accent-emerald-glow);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 var(--accent-emerald-glow);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    /* Grid layout for cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }

    .stat-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: var(--accent-violet);
    }

    .stat-card.emerald::before { background: var(--accent-emerald); }
    .stat-card.cyan::before { background: var(--accent-cyan); }
    .stat-card.gold::before { background: var(--accent-gold); }
    .stat-card.rose::before { background: var(--accent-rose); }

    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-header i {
      font-size: 18px;
    }

    .stat-value {
      font-family: 'Outfit', sans-serif;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .stat-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* Progress bar for memory/cpu */
    .progress-bar-container {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(to right, var(--accent-violet), #ec4899);
      width: 0%;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Middle section: Chart + Doughnut */
    .charts-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 20px;
    }

    @media (max-width: 1024px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .chart-panel {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chart-title {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .chart-legend {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .chart-canvas-container {
      position: relative;
      width: 100%;
      height: 300px;
    }

    /* Lower Section: Recent Submissions Table */
    .submissions-panel {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .table-container {
      overflow-x: auto;
      width: 100%;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      padding: 14px 16px;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--panel-border);
    }

    td {
      padding: 14px 16px;
      font-size: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      color: var(--text-primary);
    }

    tbody tr {
      transition: background 0.2s;
    }

    tbody tr:hover {
      background: rgba(255, 255, 255, 0.015);
    }

    /* Glowing Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-accepted {
      background: rgba(16, 185, 129, 0.1);
      color: var(--accent-emerald);
      border: 1px solid rgba(16, 185, 129, 0.25);
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.08);
    }

    .badge-wrong {
      background: rgba(245, 158, 11, 0.1);
      color: var(--accent-gold);
      border: 1px solid rgba(245, 158, 11, 0.25);
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.08);
    }

    .badge-error {
      background: rgba(239, 68, 68, 0.1);
      color: var(--accent-rose);
      border: 1px solid rgba(239, 68, 68, 0.25);
      box-shadow: 0 0 10px rgba(239, 68, 68, 0.08);
    }

    .badge-pending {
      background: rgba(14, 165, 233, 0.1);
      color: var(--accent-sky);
      border: 1px solid rgba(14, 165, 233, 0.25);
      box-shadow: 0 0 10px rgba(14, 165, 233, 0.08);
      animation: pulse-blue 1.5s infinite;
    }

    @keyframes pulse-blue {
      0% { opacity: 0.6; }
      50% { opacity: 1; }
      100% { opacity: 0.6; }
    }

    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
      padding: 16px;
      margin-top: 16px;
    }

    .spin {
      animation: fa-spin 1.5s infinite linear;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="glass-panel">
      <div class="brand">
        <h1><i class="fa-solid fa-server"></i> Code Judge System Monitor</h1>
        <p>實時監控平台效能、資料庫健康度與代碼評測佇列</p>
      </div>
      <div class="controls">
        <div class="select-wrapper">
          <select id="refreshRate" onchange="setupAutoRefresh()">
            <option value="3000">自動更新: 3秒</option>
            <option value="5000" selected>自動更新: 5秒</option>
            <option value="10000">自動更新: 10秒</option>
            <option value="0">停止自動更新</option>
          </select>
        </div>
        <button class="btn" id="refreshBtn" onclick="triggerManualRefresh()">
          <i class="fa-solid fa-rotate-right" id="refreshIcon"></i> 手動重新整理
        </button>
      </div>
    </header>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <!-- Database health -->
      <div class="glass-panel stat-card emerald">
        <div class="stat-header">
          <span>資料庫連接狀況</span>
          <i class="fa-solid fa-database" style="color: var(--accent-emerald);"></i>
        </div>
        <div class="stat-value" id="dbStatusValue" style="color: var(--accent-emerald);">
          <span class="pulse-dot"></span> PINGING...
        </div>
        <div class="stat-footer" id="dbFooter">
          <span>查詢耗時: 0ms</span>
        </div>
      </div>

      <!-- CPU load -->
      <div class="glass-panel stat-card violet">
        <div class="stat-header">
          <span>系統 CPU 負載 (1分鐘)</span>
          <i class="fa-solid fa-microchip" style="color: var(--accent-violet);"></i>
        </div>
        <div class="stat-value" id="cpuValue">0.00 %</div>
        <div class="stat-footer">
          <div style="width: 100%">
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
              <span>核心數: <span id="cpuCount">0</span></span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="cpuProgress"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Memory load -->
      <div class="glass-panel stat-card cyan">
        <div class="stat-header">
          <span>Node 記憶體使用量</span>
          <i class="fa-solid fa-memory" style="color: var(--accent-cyan);"></i>
        </div>
        <div class="stat-value" id="memValue">0.0 MB</div>
        <div class="stat-footer">
          <div style="width: 100%">
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
              <span>系統可用: <span id="sysMemValue">0 GB</span></span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="memProgress" style="background: linear-gradient(to right, var(--accent-cyan), var(--accent-violet));"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Judge queue stats -->
      <div class="glass-panel stat-card gold">
        <div class="stat-header">
          <span>評測佇列負載</span>
          <i class="fa-solid fa-hourglass-half" style="color: var(--accent-gold);"></i>
        </div>
        <div class="stat-value" id="queueValue">0 / 0</div>
        <div class="stat-footer">
          <div style="width: 100%">
            <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
              <span>排隊中任務: <span id="queuedTasks">0</span></span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="queueProgress" style="background: linear-gradient(to right, var(--accent-gold), var(--accent-rose));"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="charts-grid">
      <!-- Line Chart -->
      <div class="glass-panel chart-panel">
        <div class="chart-title">
          <span><i class="fa-solid fa-chart-line" style="color: var(--accent-violet); margin-right: 8px;"></i> 系統資源即時趨勢圖</span>
          <div class="chart-legend">
            <div class="legend-item">
              <div class="legend-dot" style="background-color: var(--accent-violet);"></div>
              <span>Node 佔用記憶體 (RSS)</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background-color: var(--accent-cyan);"></div>
              <span>Heap 記憶體已用</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background-color: var(--accent-rose);"></div>
              <span>CPU 負載 (%)</span>
            </div>
          </div>
        </div>
        <div class="chart-canvas-container">
          <canvas id="resourceChart"></canvas>
        </div>
      </div>

      <!-- Doughnut Chart -->
      <div class="glass-panel chart-panel">
        <div class="chart-title">
          <span><i class="fa-solid fa-chart-pie" style="color: var(--accent-cyan); margin-right: 8px;"></i> 評測狀態分佈</span>
        </div>
        <div class="chart-canvas-container" style="height: 300px; display: flex; align-items: center; justify-content: center;">
          <canvas id="statusChart"></canvas>
        </div>
      </div>
    </div>

    <!-- Platform Counters Grid -->
    <div class="stats-grid">
      <div class="glass-panel stat-card" style="padding: 16px 20px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: 0;">
        <div>
          <div style="color: var(--text-secondary); font-size: 12px; font-weight: 500; text-transform: uppercase;">註冊使用者數</div>
          <div class="stat-value" id="cntUsers" style="font-size: 24px; margin-top: 4px;">0</div>
        </div>
        <i class="fa-solid fa-users" style="font-size: 28px; color: rgba(255, 255, 255, 0.1);"></i>
      </div>
      <div class="glass-panel stat-card" style="padding: 16px 20px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: 0;">
        <div>
          <div style="color: var(--text-secondary); font-size: 12px; font-weight: 500; text-transform: uppercase;">平台總題目數</div>
          <div class="stat-value" id="cntProblems" style="font-size: 24px; margin-top: 4px;">0</div>
        </div>
        <i class="fa-solid fa-laptop-code" style="font-size: 28px; color: rgba(255, 255, 255, 0.1);"></i>
      </div>
      <div class="glass-panel stat-card" style="padding: 16px 20px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: 0;">
        <div>
          <div style="color: var(--text-secondary); font-size: 12px; font-weight: 500; text-transform: uppercase;">累計評測提交</div>
          <div class="stat-value" id="cntSubmissions" style="font-size: 24px; margin-top: 4px;">0</div>
        </div>
        <i class="fa-solid fa-circle-check" style="font-size: 28px; color: rgba(255, 255, 255, 0.1);"></i>
      </div>
      <div class="glass-panel stat-card" style="padding: 16px 20px; display: flex; flex-direction: row; justify-content: space-between; align-items: center; gap: 0;">
        <div>
          <div style="color: var(--text-secondary); font-size: 12px; font-weight: 500; text-transform: uppercase;">伺服器運行時間</div>
          <div class="stat-value" id="cntUptime" style="font-size: 20px; margin-top: 6px;">0s</div>
        </div>
        <i class="fa-solid fa-clock" style="font-size: 28px; color: rgba(255, 255, 255, 0.1);"></i>
      </div>
    </div>

    <!-- Recent Submissions Table -->
    <div class="glass-panel submissions-panel">
      <div class="chart-title">
        <span><i class="fa-solid fa-list-check" style="color: var(--accent-emerald); margin-right: 8px;"></i> 即時提交活動摘要 (最新 10 筆)</span>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>提交ID</th>
              <th>使用者</th>
              <th>題目名稱</th>
              <th>語言</th>
              <th>評測結果</th>
              <th>得分</th>
              <th>耗時</th>
              <th>提交時間</th>
            </tr>
          </thead>
          <tbody id="submissionsTableBody">
            <tr>
              <td colspan="8" style="text-align: center; color: var(--text-muted);">正在加載實時數據...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <footer>
      <p>Code Judge 系統監控儀表板 v1.0 | 基於 NestJS 與 Chart.js 實時渲染</p>
    </footer>
  </div>

  <script>
    // Global stats history array for line chart (stores last 25 entries)
    const MAX_HISTORY_POINTS = 25;
    const statsHistory = {
      labels: [],
      rss: [],
      heapUsed: [],
      cpuLoad: []
    };

    let resourceChart = null;
    let statusChart = null;
    let refreshTimer = null;

    // Format uptime into human readable string
    function formatUptime(seconds) {
      const d = Math.floor(seconds / (3600 * 24));
      const h = Math.floor((seconds % (3600 * 24)) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      
      const parts = [];
      if (d > 0) parts.push(d + '天');
      if (h > 0) parts.push(h + '小時');
      if (m > 0) parts.push(m + '分');
      parts.push(s + '秒');
      return parts.join(' ');
    }

    // Format bytes to MB/GB
    function formatBytes(bytes, decimals = 1) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Initialize Charts
    function initCharts() {
      // 1. Resource Line Chart
      const ctxLine = document.getElementById('resourceChart').getContext('2d');
      resourceChart = new Chart(ctxLine, {
        type: 'line',
        data: {
          labels: statsHistory.labels,
          datasets: [
            {
              label: 'Node RSS (MB)',
              data: statsHistory.rss,
              borderColor: '#8b5cf6',
              backgroundColor: 'rgba(139, 92, 246, 0.05)',
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.3,
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'Heap Used (MB)',
              data: statsHistory.heapUsed,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.03)',
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.3,
              fill: true,
              yAxisID: 'y'
            },
            {
              label: 'CPU Load (%)',
              data: statsHistory.cpuLoad,
              borderColor: '#ef4444',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.3,
              yAxisID: 'yPercent'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#9ca3af', font: { size: 10 } }
            },
            y: {
              type: 'linear',
              position: 'left',
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#9ca3af', callback: value => value + ' MB' }
            },
            yPercent: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#ef4444', callback: value => value + '%' },
              min: 0,
              max: 100
            }
          }
        }
      });

      // 2. Status Doughnut Chart
      const ctxDoughnut = document.getElementById('statusChart').getContext('2d');
      statusChart = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
          labels: ['ACCEPTED', 'WRONG_ANSWER', 'ERRORS', 'OTHER'],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: [
              '#10b981', // Emerald for Accepted
              '#f59e0b', // Gold for WA
              '#ef4444', // Rose for Errors (TLE, MLE, Runtime)
              '#6b7280'  // Gray for others
            ],
            borderColor: 'rgba(26, 15, 43, 0.8)',
            borderWidth: 2,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#f3f4f6',
                font: { size: 11, family: 'Inter' },
                padding: 15
              }
            }
          },
          cutout: '70%'
        }
      });
    }

    // Fetch and Update Stats
    async function updateStats() {
      const refreshIcon = document.getElementById('refreshIcon');
      refreshIcon.classList.add('spin');
      
      try {
        const res = await fetch('./stats');
        if (!res.ok) throw new Error('API fetch failed');
        const data = await res.json();
        
        // 1. Update Database Stats
        const dbCard = document.getElementById('dbStatusValue');
        const dbFooter = document.getElementById('dbFooter');
        if (data.database.status === 'OK') {
          dbCard.innerHTML = '<span class="pulse-dot"></span> 在線 (ONLINE)';
          dbCard.style.color = 'var(--accent-emerald)';
          dbFooter.innerHTML = \`<span>資料庫查詢耗時: \${data.database.latencyMs} ms</span>\`;
        } else {
          dbCard.innerHTML = '<span class="pulse-dot" style="background-color: var(--accent-rose); box-shadow: 0 0 10px rgba(239, 68, 68, 0.5)"></span> 斷線 (DISCONNECTED)';
          dbCard.style.color = 'var(--accent-rose)';
          dbFooter.innerHTML = '<span style="color: var(--accent-rose)">⚠️ 無法訪問 SQLite 檔案</span>';
        }

        // 2. Update CPU Stats
        const cpuPercent = ((data.system.cpuLoad1Min / data.system.cpuCount) * 100).toFixed(1);
        document.getElementById('cpuValue').innerText = cpuPercent + ' %';
        document.getElementById('cpuCount').innerText = data.system.cpuCount;
        document.getElementById('cpuProgress').style.width = Math.min(cpuPercent, 100) + '%';
        if (cpuPercent > 80) {
          document.getElementById('cpuProgress').style.background = 'var(--accent-rose)';
        } else if (cpuPercent > 50) {
          document.getElementById('cpuProgress').style.background = 'var(--accent-gold)';
        } else {
          document.getElementById('cpuProgress').style.background = 'linear-gradient(to right, var(--accent-violet), #ec4899)';
        }

        // 3. Update Memory Stats
        const processMemoryMb = (data.system.processMemoryBytes / 1024 / 1024).toFixed(1);
        const heapUsedMb = (data.system.processHeapUsedBytes / 1024 / 1024).toFixed(1);
        document.getElementById('memValue').innerText = processMemoryMb + ' MB';
        document.getElementById('sysMemValue').innerText = formatBytes(data.system.freeMemoryBytes) + ' 可用';
        
        // Calculate heap usage percent
        const heapPercent = (data.system.processHeapUsedBytes / data.system.processHeapTotalBytes) * 100;
        document.getElementById('memProgress').style.width = Math.min(heapPercent, 100) + '%';

        // 4. Update Judge Queue Stats
        const activeCount = data.queue.active;
        const queuedCount = data.queue.queued;
        const concurrency = data.queue.concurrency;
        document.getElementById('queueValue').innerText = \`\${activeCount} / \${concurrency}\`;
        document.getElementById('queuedTasks').innerText = queuedCount;
        
        // Queue progress indicator
        const queuePercent = (activeCount / concurrency) * 100;
        document.getElementById('queueProgress').style.width = Math.min(queuePercent, 100) + '%';

        // 5. Platform Counters
        document.getElementById('cntUsers').innerText = data.counters.totalUsers;
        document.getElementById('cntProblems').innerText = data.counters.totalProblems;
        document.getElementById('cntSubmissions').innerText = data.counters.totalSubmissions;
        document.getElementById('cntUptime').innerText = formatUptime(data.system.processUptimeSeconds);

        // 6. Update Line Chart Data History
        const timeLabel = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        statsHistory.labels.push(timeLabel);
        statsHistory.rss.push(parseFloat(processMemoryMb));
        statsHistory.heapUsed.push(parseFloat(heapUsedMb));
        statsHistory.cpuLoad.push(parseFloat(cpuPercent));
        
        // Cap data point size
        if (statsHistory.labels.length > MAX_HISTORY_POINTS) {
          statsHistory.labels.shift();
          statsHistory.rss.shift();
          statsHistory.heapUsed.shift();
          statsHistory.cpuLoad.shift();
        }
        
        if (resourceChart) {
          resourceChart.update('none'); // Update smoothly without animations
        }

        // 7. Update Submission Distribution Doughnut Chart
        const accepted = data.statusCounts['ACCEPTED'] || 0;
        const wa = data.statusCounts['WRONG_ANSWER'] || 0;
        const errors = (data.statusCounts['RUNTIME_ERROR'] || 0) + 
                       (data.statusCounts['TLE'] || 0) + 
                       (data.statusCounts['MLE'] || 0) +
                       (data.statusCounts['COMPILE_ERROR'] || 0);
                       
        let totalCounted = 0;
        Object.values(data.statusCounts).forEach(v => totalCounted += v);
        const other = totalCounted - accepted - wa - errors;

        if (statusChart) {
          statusChart.data.datasets[0].data = [accepted, wa, errors, Math.max(other, 0)];
          statusChart.update();
        }

        // 8. Update Activity Feed Table
        const tbody = document.getElementById('submissionsTableBody');
        if (data.recentSubmissions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">系統中暫無提交紀錄</td></tr>';
        } else {
          tbody.innerHTML = data.recentSubmissions.map(s => {
            let badgeClass = 'badge-pending';
            let iconClass = 'fa-spinner fa-spin';
            
            if (s.status === 'ACCEPTED') {
              badgeClass = 'badge-accepted';
              iconClass = 'fa-circle-check';
            } else if (s.status === 'WRONG_ANSWER') {
              badgeClass = 'badge-wrong';
              iconClass = 'fa-circle-xmark';
            } else if (['TLE', 'MLE', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'INTERNAL_ERROR'].includes(s.status)) {
              badgeClass = 'badge-error';
              iconClass = 'fa-triangle-exclamation';
            }

            const formattedTime = new Date(s.createdAt).toLocaleString('zh-TW', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return \`
              <tr>
                <td style="font-family: monospace; font-size:12px; color: var(--text-secondary)">\${s.id.substring(0, 8)}...</td>
                <td><strong>\${s.username}</strong></td>
                <td>\${s.problemTitle}</td>
                <td><span style="font-family: monospace; text-transform: uppercase;">\${s.language}</span></td>
                <td>
                  <span class="badge \${badgeClass}">
                    <i class="fa-solid \${iconClass}"></i> \${s.status}
                  </span>
                </td>
                <td style="font-weight: 600; color: \${s.score == 100 ? 'var(--accent-emerald)' : 'var(--text-primary)'}">\${s.score}</td>
                <td>\${s.executionTimeMs} ms</td>
                <td style="color: var(--text-muted); font-size: 13px;">\${formattedTime}</td>
              </tr>
            \`;
          }).join('');
        }

      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setTimeout(() => {
          refreshIcon.classList.remove('spin');
        }, 600);
      }
    }

    // Triggers manual refresh and rotates icon nicely
    function triggerManualRefresh() {
      updateStats();
    }

    // Auto Refresh Setting
    function setupAutoRefresh() {
      const rate = parseInt(document.getElementById('refreshRate').value);
      
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      
      if (rate > 0) {
        refreshTimer = setInterval(updateStats, rate);
      }
    }

    // Bootstrap Dashboard
    window.onload = function() {
      initCharts();
      updateStats().then(() => {
        // Pre-populate line chart with historical zeros or identical initial points so it looks complete from start
        const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        for (let i = 0; i < 5; i++) {
          if (statsHistory.labels.length < 5) {
            statsHistory.labels.unshift(timeLabel);
            statsHistory.rss.unshift(statsHistory.rss[0] || 0);
            statsHistory.heapUsed.unshift(statsHistory.heapUsed[0] || 0);
            statsHistory.cpuLoad.unshift(statsHistory.cpuLoad[0] || 0);
          }
        }
        if (resourceChart) resourceChart.update();
      });
      setupAutoRefresh();
    };
  </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
