// Loop driver of the background worker: one poll loop per task, all stopped
// together on SIGTERM/SIGINT. Pure — the process (scripts/worker.mjs) wires
// in the stopper and the logger, tests pass fakes.

/**
 * @typedef {{ debug: Function, info: Function, warn: Function, error: Function }} Log
 * @typedef {{ isStopped: () => boolean, sleep: (ms: number) => Promise<void>, log: Log }} LoopCtx
 * @typedef {{ name: string, tick: () => Promise<number>, pollMs: number }} LoopSpec
 */

/**
 * Stop switch with interruptible sleep: stop() wakes every sleeping loop at
 * once — otherwise a loop with an hourly interval would keep the process alive
 * until the orchestrator sends SIGKILL.
 */
export function createStopper() {
  let stopped = false;
  const waiting = new Set();
  return {
    isStopped: () => stopped,
    stop() {
      stopped = true;
      for (const wake of [...waiting]) wake();
    },
    /** @param {number} ms */
    sleep(ms) {
      if (stopped) return Promise.resolve();
      return new Promise((resolve) => {
        const wake = () => {
          clearTimeout(timer);
          waiting.delete(wake);
          resolve();
        };
        const timer = setTimeout(wake, ms);
        waiting.add(wake);
      });
    },
  };
}

/** How long an outage only counts as `warn`: covers a restart of the Supabase services. */
export const OUTAGE_GRACE_MS = 5 * 60_000;

/**
 * Errors meaning "service unreachable": PostgREST without schema cache
 * (PGRST002, right after a DB restart), refused or reset connections.
 */
export function isConnectivityError(err) {
  const text = String(err?.message || err);
  return /schema cache|PGRST002|fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(
    text,
  );
}

/**
 * Run `tick()` until stopped. Sleeps only when the tick processed nothing, so
 * a backlog drains at full speed. A connectivity error is `warn` during the
 * grace period and `error` afterwards — a deploy or DB restart must not trip
 * an error-rate alarm; other errors are `error` right away. A throwing tick
 * never kills the loop.
 * @param {LoopSpec} spec
 * @param {LoopCtx} ctx
 */
export async function runLoop(
  { name, tick, pollMs },
  { isStopped, sleep, log },
  { graceMs = OUTAGE_GRACE_MS, now = Date.now } = {},
) {
  let outageSince = null;
  while (!isStopped()) {
    let processed = 0;
    try {
      processed = await tick();
      if (outageSince != null) {
        log.info(`${name}: recovered`, { outageMs: now() - outageSince });
        outageSince = null;
      }
    } catch (err) {
      const fields = { loop: name, err: String(err?.stack || err) };
      if (isConnectivityError(err)) {
        const t = now();
        outageSince ??= t;
        const outageMs = t - outageSince;
        log[outageMs < graceMs ? "warn" : "error"](`${name}: tick threw`, {
          ...fields,
          outageMs,
        });
      } else {
        log.error(`${name}: tick threw`, fields);
      }
    }
    if (!isStopped() && processed === 0) await sleep(pollMs);
  }
}

/**
 * Start all loops of the plan and resolve once every loop has stopped.
 * @param {LoopSpec[]} plan
 * @param {LoopCtx} ctx
 */
export function runPlan(plan, ctx) {
  return Promise.all(plan.map((spec) => runLoop(spec, ctx)));
}
