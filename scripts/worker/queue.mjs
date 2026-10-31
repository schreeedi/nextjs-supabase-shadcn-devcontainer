// Queue consumer for public.jobs + pgmq (supabase/migrations/*_job_queue.sql):
// claim a batch, run the handler for each job's `type`, report the outcome.
// Retry/backoff/dead-letter decisions live in SQL (worker_finish_job), so
// every worker instance behaves the same.

/**
 * Throw from a handler when retrying cannot help (invalid payload, record
 * gone, 4xx from a remote API): the job goes straight to 'dead'.
 */
export class PermanentError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "PermanentError";
  }
}

/**
 * Call a finishing RPC, retrying on error. If the finish never lands, the
 * lease expires and the job runs again — for a sent mail that means twice.
 * worker_finish_job tolerates a repeated call (second one returns 'stale').
 */
export async function finishWithRetry(
  sb,
  args,
  {
    delaysMs = [500, 2000],
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {},
) {
  let res = await sb.rpc("worker_finish_job", args);
  for (const ms of delaysMs) {
    if (!res.error) break;
    await sleep(ms);
    res = await sb.rpc("worker_finish_job", args);
  }
  return res;
}

/**
 * @typedef {{ msg_id: number, job_id: string, type: string, payload: any, user_id: string | null, attempts: number, max_attempts: number }} Job
 * @typedef {(job: Job, ctx: { log: any }) => Promise<unknown>} Handler
 *
 * @param {{
 *   sb: any,
 *   log: any,
 *   queue: string,
 *   handlers: Record<string, Handler>,
 *   batch?: number,
 *   visibilitySeconds?: number,
 *   concurrency?: "serial" | "parallel",
 *   finishDelaysMs?: number[],
 *   sleep?: (ms: number) => Promise<void>,
 * }} opts
 * `visibilitySeconds` must exceed the slowest handler — otherwise the lease
 * runs out mid-job and a second worker picks the same job up.
 */
export function createQueueWorker({
  sb,
  log,
  queue,
  handlers,
  batch = 10,
  visibilitySeconds = 60,
  concurrency = "serial",
  finishDelaysMs,
  sleep,
}) {
  async function runJob(job) {
    const jobLog = log.child({
      queue,
      job: job.job_id,
      type: job.type,
      attempt: job.attempts,
    });
    const handler = handlers[job.type];
    let ok = true;
    let error = null;
    let result = null;
    let permanent = false;
    const t0 = Date.now();
    try {
      if (!handler)
        throw new PermanentError(`no handler for job type "${job.type}"`);
      result = (await handler(job, { log: jobLog })) ?? null;
    } catch (err) {
      ok = false;
      permanent = err instanceof PermanentError;
      error = String(err?.stack || err?.message || err);
    }
    const { data: outcome, error: finishError } = await finishWithRetry(
      sb,
      {
        p_queue: queue,
        p_msg_id: job.msg_id,
        p_job_id: job.job_id,
        p_ok: ok,
        p_error: error,
        p_result: result,
        p_permanent: permanent,
      },
      { delaysMs: finishDelaysMs, sleep },
    );
    const durationMs = Date.now() - t0;
    if (finishError) {
      jobLog.error("job finish failed", {
        err: finishError.message,
        durationMs,
      });
      return;
    }
    // done → info, retry → warn, dead → error (feeds alerting on error rate)
    const level =
      outcome === "dead" ? "error" : outcome === "retry" ? "warn" : "info";
    jobLog[level](`job ${outcome}`, {
      outcome,
      durationMs,
      ...(error ? { err: error } : {}),
    });
  }

  /** One round: claim, process, return how many jobs were claimed. */
  async function tick() {
    const { data, error } = await sb.rpc("worker_claim_jobs", {
      p_queue: queue,
      p_batch: batch,
      p_vt: visibilitySeconds,
    });
    // Thrown, so runLoop applies its outage grace period to connectivity errors.
    if (error) throw new Error(`claim ${queue}: ${error.message}`);
    const jobs = data ?? [];
    if (concurrency === "parallel") await Promise.all(jobs.map(runJob));
    else for (const job of jobs) await runJob(job);
    return jobs.length;
  }

  return { tick, runJob };
}
