import { describe, it, expect, vi } from "vitest";
import {
  createQueueMonitor,
  queueProblems,
} from "@/scripts/worker/monitor.mjs";
import { buildPlan, defaultHandlers } from "@/scripts/worker/plan.mjs";

const healthy = {
  queue_name: "default",
  queue_length: 3,
  oldest_msg_age_sec: 10,
  dead_recent: 0,
};

describe("queueProblems", () => {
  it("is empty for a healthy queue", () => {
    expect(queueProblems(healthy)).toEqual([]);
    expect(queueProblems({ ...healthy, oldest_msg_age_sec: null })).toEqual([]);
  });

  it("reports backlog, age and dead jobs", () => {
    expect(
      queueProblems(
        {
          ...healthy,
          queue_length: 11,
          oldest_msg_age_sec: 61,
          dead_recent: 2,
        },
        { maxBacklog: 10, maxAgeSec: 60 },
      ),
    ).toEqual([
      "backlog 11 > 10",
      "oldest message 61s > 60s",
      "2 dead job(s) in the last 24 h",
    ]);
  });
});

describe("createQueueMonitor", () => {
  it("logs errors while unhealthy, recovery once, steady health only at debug", async () => {
    const rounds = [
      [healthy],
      [{ ...healthy, dead_recent: 1 }],
      [{ ...healthy, dead_recent: 1 }],
      [healthy],
      [healthy],
    ];
    const rpc = vi.fn(async () => ({ data: rounds.shift(), error: null }));
    const log = { debug: vi.fn(), info: vi.fn(), error: vi.fn() };
    const tick = createQueueMonitor({ sb: { rpc }, log });
    for (let i = 0; i < 5; i++) expect(await tick()).toBe(0);
    expect(log.error).toHaveBeenCalledTimes(2);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info).toHaveBeenCalledWith(
      "queue recovered",
      expect.objectContaining({ queue: "default" }),
    );
    expect(log.debug).toHaveBeenCalledTimes(2);
  });

  it("throws on RPC errors", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "down" } }));
    const tick = createQueueMonitor({
      sb: { rpc },
      log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
    });
    await expect(tick()).rejects.toThrow("queue_health: down");
  });
});

describe("buildPlan", () => {
  it("wires the default queue and the monitor with env intervals", () => {
    const log = { child: () => log, info: vi.fn() };
    const plan = buildPlan({
      sb: {},
      log,
      env: { WORKER_POLL_MS: "500", WORKER_MONITOR_MS: "1000" },
    });
    expect(plan.map((l) => [l.name, l.pollMs])).toEqual([
      ["queue:default", 500],
      ["monitor:queues", 1000],
    ]);
  });

  it("example handler echoes", async () => {
    const log = { info: vi.fn() };
    await expect(
      defaultHandlers["example.echo"]({ payload: { a: 1 } } as never, { log }),
    ).resolves.toEqual({ echoed: true });
  });
});
