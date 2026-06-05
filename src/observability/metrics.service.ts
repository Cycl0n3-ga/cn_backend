import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { SubmissionStatus } from '../submissions/submission-status.js';
import type { JudgeQueueStats } from '../judge/judge-jobs.js';

type MetricsServiceOptions = {
  collectDefaultMetrics?: boolean;
};

export const METRICS_PREFIX = 'code_judge_';

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpRequestsTotal = new Counter({
    name: `${METRICS_PREFIX}http_requests_total`,
    help: 'Total number of HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  private readonly httpRequestDurationSeconds = new Histogram({
    name: `${METRICS_PREFIX}http_request_duration_seconds`,
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly judgeJobsTotal = new Counter({
    name: `${METRICS_PREFIX}judge_jobs_total`,
    help: 'Total number of judge job lifecycle events.',
    labelNames: ['name', 'status'],
    registers: [this.registry],
  });

  private readonly judgeJobDurationSeconds = new Histogram({
    name: `${METRICS_PREFIX}judge_job_duration_seconds`,
    help: 'Judge job execution duration in seconds.',
    labelNames: ['name', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
    registers: [this.registry],
  });

  private readonly queueJobsGauge = new Gauge({
    name: `${METRICS_PREFIX}judge_queue_jobs`,
    help: 'Current judge queue jobs by state.',
    labelNames: ['driver', 'state'],
    registers: [this.registry],
  });

  private readonly queueConcurrencyGauge = new Gauge({
    name: `${METRICS_PREFIX}judge_queue_concurrency`,
    help: 'Configured judge queue worker concurrency.',
    labelNames: ['driver'],
    registers: [this.registry],
  });

  private readonly databaseUpGauge = new Gauge({
    name: `${METRICS_PREFIX}database_up`,
    help: 'Database availability, where 1 means up and 0 means down.',
    registers: [this.registry],
  });

  private readonly databaseLatencySeconds = new Gauge({
    name: `${METRICS_PREFIX}database_latency_seconds`,
    help: 'Database health check latency in seconds.',
    registers: [this.registry],
  });

  private readonly submissionsGauge = new Gauge({
    name: `${METRICS_PREFIX}submissions_total`,
    help: 'Current submissions by status.',
    labelNames: ['status'],
    registers: [this.registry],
  });

  constructor(options: MetricsServiceOptions = {}) {
    if (options.collectDefaultMetrics ?? true) {
      collectDefaultMetrics({
        prefix: METRICS_PREFIX,
        register: this.registry,
      });
    }
  }

  get contentType() {
    return this.registry.contentType;
  }

  observeHttpRequest(input: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }) {
    const labels = {
      method: input.method.toUpperCase(),
      route: this.normalizeRoute(input.path),
      status_code: String(input.statusCode),
    };
    const durationSeconds = input.durationMs / 1000;

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  recordJudgeJobStarted(name: string) {
    this.judgeJobsTotal.inc({ name, status: 'started' });
  }

  recordJudgeJobCompleted(name: string, durationMs: number) {
    this.recordJudgeJobFinished(name, 'completed', durationMs);
  }

  recordJudgeJobFailed(name: string, durationMs: number) {
    this.recordJudgeJobFinished(name, 'failed', durationMs);
  }

  setQueueStats(stats: JudgeQueueStats) {
    const states = {
      active: stats.active,
      waiting: stats.waiting,
      delayed: stats.delayed,
      failed: stats.failed,
      completed: stats.completed,
    };

    for (const [state, value] of Object.entries(states)) {
      this.queueJobsGauge.set({ driver: stats.driver, state }, value);
    }
    this.queueConcurrencyGauge.set({ driver: stats.driver }, stats.concurrency);
  }

  setDatabaseHealth(input: { up: boolean; latencyMs: number }) {
    this.databaseUpGauge.set(input.up ? 1 : 0);
    this.databaseLatencySeconds.set(Math.max(input.latencyMs, 0) / 1000);
  }

  setSubmissionStatusCounts(counts: Record<string, number>) {
    const statuses = Object.values(SubmissionStatus);
    for (const status of statuses) {
      this.submissionsGauge.set({ status }, counts[status] ?? 0);
    }
  }

  async metrics() {
    return this.registry.metrics();
  }

  private recordJudgeJobFinished(
    name: string,
    status: 'completed' | 'failed',
    durationMs: number,
  ) {
    const durationSeconds = Math.max(durationMs, 0) / 1000;
    this.judgeJobsTotal.inc({ name, status });
    this.judgeJobDurationSeconds.observe({ name, status }, durationSeconds);
  }

  private normalizeRoute(path: string) {
    const pathname = path.split('?')[0] || '/';
    return pathname
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
        '/:id',
      )
      .replace(/\/\d+(?=\/|$)/g, '/:id');
  }
}

export const defaultMetricsService = new MetricsService();
