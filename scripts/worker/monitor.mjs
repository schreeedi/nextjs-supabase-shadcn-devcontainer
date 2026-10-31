// Queue monitoring: once per interval, log backlog and failures of every
// queue (public.queue_health). The log line is the metric — a collector
// (Loki/Grafana, Logflare, Datadog …) can graph `queue_length` and alert on
// level=error without any agent in the app.

/**
 * @typedef {{ queue_name: string, queue_length: number, oldest_msg_age_sec: number | null, dead_recent: number }} QueueHealth
 * @typedef {{ maxBacklog: number, maxAgeSec: number }} Thresholds
 */

export const DEFAULT_THRESHOLDS = { maxBacklog: 1000, maxAgeSec: 15 * 60 };

/**
 * Problems of one queue, empty when healthy. Age counts the oldest message
 * including delayed retries, so the default threshold is generous.
 * @param {QueueHealth} q
 * @param {Thresholds} t
 */
export function queueProblems(q, t = DEFAULT_THRESHOLDS) {
  const problems = [];
  if (q.queue_length > t.maxBacklog)
    problems.push(`backlog ${q.queue_length} > ${t.maxBacklog}`);
  if ((q.oldest_msg_age_sec ?? 0) > t.maxAgeSec) {
    problems.push(`oldest message ${q.oldest_msg_age_sec}s > ${t.maxAgeSec}s`);
  }
  if (q.dead_recent > 0)
    problems.push(`${q.dead_recent} dead job(s) in the last 24 h`);
  return problems;
}

/**
 * Loop tick: always returns 0 so runLoop sleeps the full interval.
 * Logs only what carries information: `error` while a queue is unhealthy,
 * `info` once when it recovers. A healthy, unchanged queue is `debug` — no
 * minute-by-minute "all fine" lines in production logs.
 */
export function createQueueMonitor({
  sb,
  log,
  thresholds = DEFAULT_THRESHOLDS,
}) {
  const unhealthy = new Set();
  return async function tick() {
    const { data, error } = await sb.rpc("queue_health");
    if (error) throw new Error(`queue_health: ${error.message}`);
    for (const q of data ?? []) {
      const problems = queueProblems(q, thresholds);
      const fields = {
        queue: q.queue_name,
        queue_length: q.queue_length,
        oldest_msg_age_sec: q.oldest_msg_age_sec,
        dead_recent: q.dead_recent,
      };
      if (problems.length) {
        unhealthy.add(q.queue_name);
        log.error("queue unhealthy", { ...fields, problems });
      } else if (unhealthy.delete(q.queue_name)) {
        log.info("queue recovered", fields);
      } else {
        log.debug("queue health", fields);
      }
    }
    return 0;
  };
}
