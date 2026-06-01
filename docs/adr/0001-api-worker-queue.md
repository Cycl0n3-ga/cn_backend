# ADR 0001: Separate API and Judge Worker with Redis/BullMQ

## Status

Accepted

## Context

The previous implementation accepted a submission and started judging inside the API process with an in-memory queue. That was simple, but it meant:

- API restarts could lose pending jobs.
- API containers needed Docker socket access.
- Horizontal scaling was unclear because each API instance had its own memory queue.
- Production operations had weak visibility into job retries and stuck submissions.

## Decision

Use a queue-based architecture:

- `backend-api` creates the submission row and enqueues a BullMQ job.
- Redis stores durable job state.
- `judge-worker` consumes jobs, runs Docker sandbox execution, and writes terminal results.
- Production requires `JUDGE_QUEUE_DRIVER=redis` and `REDIS_URL`.
- Tests may use `JUDGE_QUEUE_DRIVER=inline` to keep the test suite deterministic and lightweight.

## Consequences

Positive:

- API can scale separately from judge workers.
- Jobs survive API restarts.
- Docker socket access is limited to the worker service.
- Retry/recovery behavior is explicit.

Trade-offs:

- Redis becomes required for production.
- Deployment now includes one more service.
- Worker failures must be monitored separately from API failures.

## Follow-up

- Consider rootless Docker/gVisor/Firecracker for stronger sandbox isolation.
- Move production DB from SQLite to PostgreSQL if concurrent write load grows.
