import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService({ collectDefaultMetrics: false });
  });

  it('should expose HTTP request counters and duration histograms', async () => {
    service.observeHttpRequest({
      method: 'get',
      path: '/api/v1/submissions/7e5f8a6b-4f68-4c91-9f2d-53bb5d5f5e11',
      statusCode: 200,
      durationMs: 125,
    });

    const output = await service.metrics();

    expect(output).toContain('code_judge_http_requests_total');
    expect(output).toContain('code_judge_http_request_duration_seconds');
    expect(output).toContain('route="/api/v1/submissions/:id"');
    expect(output).toContain('status_code="200"');
  });

  it('should expose judge queue, database and submission gauges', async () => {
    service.setQueueStats({
      driver: 'redis',
      active: 1,
      waiting: 2,
      delayed: 3,
      failed: 4,
      completed: 5,
      concurrency: 2,
    });
    service.setDatabaseHealth({ up: true, latencyMs: 42 });
    service.setSubmissionStatusCounts({
      ACCEPTED: 6,
      PENDING: 7,
    });

    const output = await service.metrics();

    expect(output).toContain('code_judge_judge_queue_jobs');
    expect(output).toContain('state="waiting"');
    expect(output).toContain('code_judge_database_up 1');
    expect(output).toContain('code_judge_database_latency_seconds 0.042');
    expect(output).toContain('code_judge_submissions_total');
    expect(output).toContain('status="ACCEPTED"');
  });

  it('should expose judge job lifecycle metrics', async () => {
    service.recordJudgeJobStarted('submission');
    service.recordJudgeJobCompleted('submission', 250);
    service.recordJudgeJobFailed('sample', 75);

    const output = await service.metrics();

    expect(output).toContain('code_judge_judge_jobs_total');
    expect(output).toContain('name="submission",status="started"');
    expect(output).toContain('name="submission",status="completed"');
    expect(output).toContain('name="sample",status="failed"');
    expect(output).toContain('code_judge_judge_job_duration_seconds');
  });
});
