import { describe, it, expect, vi } from "vitest";
import {
  createStopper,
  isConnectivityError,
  runLoop,
  runPlan,
} from "@/scripts/worker/loop.mjs";

function fakeLog() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** Context that stops after `rounds` sleeps and records the sleep durations. */
function ctxFor(rounds: number) {
  let left = rounds;
  const sleeps: number[] = [];
  const log = fakeLog();
  return {
    log,
    sleeps,
    ctx: {
      isStopped: () => left <= 0,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        left--;
      },
      log,
    },
  };
}

describe("createStopper", () => {
  it("wakes sleeping loops immediately on stop()", async () => {
    vi.useFakeTimers();
    const stopper = createStopper();
    let woke = false;
    const sleeping = stopper.sleep(60 * 60_000).then(() => (woke = true));
    stopper.stop();
    await sleeping;
    expect(woke).toBe(true);
    expect(stopper.isStopped()).toBe(true);
  });

  it("resolves at once when already stopped", async () => {
    const stopper = createStopper();
    stopper.stop();
    await expect(stopper.sleep(10_000)).resolves.toBeUndefined();
  });

  it("resolves after the timeout otherwise", async () => {
    vi.useFakeTimers();
    const stopper = createStopper();
    const done = vi.fn();
    void stopper.sleep(1000).then(done);
    await vi.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });
});

describe("isConnectivityError", () => {
  it("recognises unreachable-service errors", () => {
    expect(isConnectivityError(new Error("fetch failed"))).toBe(true);
    expect(isConnectivityError({ message: "PGRST002 schema cache" })).toBe(
      true,
    );
    expect(isConnectivityError("connect ECONNREFUSED 127.0.0.1")).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isConnectivityError(new Error("duplicate key"))).toBe(false);
  });
});

describe("runLoop", () => {
  it("sleeps only when a tick processed nothing", async () => {
    const { ctx, sleeps } = ctxFor(2);
    const tick = vi
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    await runLoop({ name: "jobs", tick, pollMs: 500 }, ctx);
    expect(tick).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([500, 500]);
  });

  it("keeps running when a tick throws and logs it as error", async () => {
    const { ctx, log } = ctxFor(2);
    const tick = vi
      .fn()
      .mockRejectedValueOnce(new Error("bad row"))
      .mockResolvedValue(0);
    await runLoop({ name: "jobs", tick, pollMs: 1 }, ctx);
    expect(log.error).toHaveBeenCalledWith(
      "jobs: tick threw",
      expect.objectContaining({ loop: "jobs" }),
    );
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("treats connectivity errors as warn within the grace period, then error, then recovered", async () => {
    const { ctx, log } = ctxFor(4);
    let t = 0;
    const now = () => t;
    const tick = vi.fn(async () => {
      t += 1000;
      if (tick.mock.calls.length <= 3) throw new Error("fetch failed");
      return 0;
    });
    await runLoop({ name: "jobs", tick, pollMs: 1 }, ctx, {
      graceMs: 1500,
      now,
    });
    expect(log.warn).toHaveBeenCalledTimes(2); // outage 0 ms, 1000 ms
    expect(log.error).toHaveBeenCalledTimes(1); // outage 2000 ms
    expect(log.info).toHaveBeenCalledWith("jobs: recovered", {
      outageMs: 3000,
    });
  });
});

describe("runPlan", () => {
  it("runs every loop until stopped, waking loops that sleep", async () => {
    const stopper = createStopper();
    // a ticks and goes to sleep for an hour; b's stop() must wake it.
    const a = vi.fn(async () => 0);
    const b = vi.fn(async () => (stopper.stop(), 0));
    await runPlan(
      [
        { name: "a", tick: a, pollMs: 60 * 60_000 },
        { name: "b", tick: b, pollMs: 10 },
      ],
      { ...stopper, log: fakeLog() },
    );
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
