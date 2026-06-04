# ADR 0002: Request IDs, Structured Logs and Uniform Error Responses

## Status

Accepted

## Context

Code judge failures can come from HTTP validation, authorization, DB state, queue availability, worker failures, Docker daemon errors, user code runtime errors, or test case data. Without correlation IDs and consistent error bodies, production debugging becomes slow and ambiguous.

## Decision

- Every HTTP request receives or preserves an `x-request-id`.
- Responses echo `x-request-id`.
- The global exception filter returns:

```json
{
  "statusCode": 400,
  "error": "BadRequest",
  "message": "Validation failed",
  "path": "/api/v1/example",
  "requestId": "uuid",
  "timestamp": "2026-05-31T00:00:00.000Z"
}
```

- Request completion is logged as structured JSON with method, path, status and duration.
- Judge jobs log `judge_job_started`, `judge_job_completed`, and `judge_job_failed`.
- `GET /api/v1/metrics` exposes Prometheus text metrics for HTTP request totals/durations, database up/latency, submission status counts, judge queue depth/concurrency, judge worker lifecycle/duration and Node.js process defaults.

## Consequences

Positive:

- Frontend and backend can report the same request id.
- Logs can be searched by request/job id.
- Error response shape is stable across modules.
- Prometheus/Grafana can monitor latency, 5xx spikes, queue backlog, worker failures and database availability without parsing application logs.

Trade-offs:

- Existing clients should tolerate additional fields in error bodies.
- Full distributed tracing is still future work.
- Metrics labels are intentionally low-cardinality; dynamic numeric ids and UUID segments are normalized before recording HTTP route metrics.
