# ADR-001: Background jobs on Supabase Queues (pgmq)

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Mails, exports, webhooks, third-party syncs and cleanups must not run inside
a request: they are slow, can fail transiently and need retries. Fire-and-
forget promises in a route handler are lost on every deploy or crash and
leave no trace. The stack already runs Postgres (Supabase) everywhere — dev,
CI, prod.

## Decision

Every piece of async work is a **job**: a row in `public.jobs` (status,
attempts, last error, result, owner) plus a pgmq message pointing to it,
created in one transaction by `enqueue_job()`. A separate worker process
(`scripts/worker.mjs`, bundled with esbuild) claims messages with a
visibility timeout (`worker_claim_jobs`) and reports the outcome
(`worker_finish_job`). Retry with exponential backoff, dead letter after
`max_attempts`, idempotent finish and a poison sweep are implemented **in SQL**,
so every worker instance behaves the same.

Code: `supabase/migrations/*_job_queue.sql`, `lib/queue.ts`,
`scripts/worker/`.

## Alternatives considered

- **In-process work / `after()` in Next** — lost on deploy/crash, no retry, no
  visibility, competes with request handling.
- **Redis-based queue (BullMQ etc.)** — another stateful service to run,
  back up and secure; job state outside the database the app queries.
- **Hosted queue (SQS, Cloud Tasks, Inngest …)** — vendor coupling, extra
  credentials, no local equivalent in the devcontainer.
- **Plain table polled with `FOR UPDATE SKIP LOCKED`** — works, but
  re-implements visibility timeouts, delays and archiving that pgmq provides.

## Consequences

- Job state is queryable with SQL and visible to the owning user via RLS;
  the admin console shows it without extra tooling.
- Handlers must be **idempotent** (a job can run twice) and
  `visibilitySeconds` must exceed the slowest handler.
- Throughput is bounded by Postgres; fine for typical SaaS volumes. Revisit
  when sustained load reaches thousands of jobs per second or jobs need
  fan-out to many consumers.
- The worker is its own deployable; it must never import `next/*`
  (`scripts/build-worker-bundle.test.ts`).
