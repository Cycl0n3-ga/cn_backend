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

## Consequences

Positive:

- Frontend and backend can report the same request id.
- Logs can be searched by request/job id.
- Error response shape is stable across modules.

Trade-offs:

- Existing clients should tolerate additional fields in error bodies.
- Full distributed tracing is still future work.
