// Which loops the worker runs. Add a queue here after creating it in a
// migration (`select pgmq.create('<name>')`); add job types to its handlers.
import { createQueueWorker } from "./queue.mjs";
import { createQueueMonitor } from "./monitor.mjs";

/** Handlers of the `default` queue, keyed by job type. */
export const defaultHandlers = {
  // Example — enqueue with enqueueJob(service, "default", "example.echo", {…})
  // from server code (lib/queue.ts). Replace with real work.
  "example.echo": async (job, { log }) => {
    log.info("echo", { payload: job.payload });
    return { echoed: true };
  },
};

/**
 * @param {{ sb: any, log: any, env: Record<string, string | undefined> }} deps
 * @returns {import("./loop.mjs").LoopSpec[]}
 */
export function buildPlan({ sb, log, env }) {
  const pollMs = Number(env.WORKER_POLL_MS) || 2000;
  return [
    {
      name: "queue:default",
      pollMs,
      tick: createQueueWorker({
        sb,
        log: log.child({ loop: "queue:default" }),
        queue: "default",
        handlers: defaultHandlers,
      }).tick,
    },
    {
      name: "monitor:queues",
      pollMs: Number(env.WORKER_MONITOR_MS) || 60_000,
      tick: createQueueMonitor({
        sb,
        log: log.child({ loop: "monitor:queues" }),
      }),
    },
  ];
}
