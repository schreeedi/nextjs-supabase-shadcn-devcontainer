import { describe, it, expect, vi } from "vitest";
import {
  createQueueWorker,
  finishWithRetry,
  PermanentError,
} from "@/scripts/worker/queue.mjs";

function fakeLog() {
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => log),
  };
  return log;
}

const job = (type: string, extra = {}) => ({
  msg_id: 1,
  job_id: "j1",
  type,
  payload: { a: 1 },
  user_id: null,
  attempts: 1,
  max_attempts: 5,
  ...extra,
});

/** Supabase stub: claim returns `jobs`, finish returns `outcome`. */
function fakeSb(jobs: unknown[], outcome = "done") {
  const rpc = vi.fn(async (name: string, _args: unknown) =>
    name === "worker_claim_jobs"
      ? { data: jobs, error: null }
      : { data: outcome, error: null },
  );
  const finishArgs = () =>
    rpc.mock.calls.filter(([n]) => n === "worker_finish_job").map(([, a]) => a);
  return { sb: { rpc }, rpc, finishArgs };
}

describe("createQueueWorker", () => {
  it("runs the handler for the job type and reports success with its result", async () => {
    const { sb, finishArgs } = fakeSb([job("echo")]);
    const echo = vi.fn(async () => ({ ok: 1 }));
    const w = createQueueWorker({
      sb,
      log: fakeLog(),
      queue: "default",
      handlers: { echo },
    });
    expect(await w.tick()).toBe(1);
    expect(echo).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { a: 1 } }),
      expect.anything(),
    );
    expect(finishArgs()).toEqual([
      expect.objectContaining({
        p_queue: "default",
        p_ok: true,
        p_result: { ok: 1 },
        p_permanent: false,
      }),
    ]);
  });

  it("reports a thrown error as retryable and logs warn on retry", async () => {
    const { sb, finishArgs } = fakeSb([job("echo")], "retry");
    const log = fakeLog();
    const w = createQueueWorker({
      sb,
      log,
      queue: "default",
      handlers: { echo: async () => Promise.reject(new Error("timeout")) },
    });
    await w.tick();
    expect(finishArgs()[0]).toMatchObject({ p_ok: false, p_permanent: false });
    expect(log.warn).toHaveBeenCalledWith(
      "job retry",
      expect.objectContaining({ outcome: "retry" }),
    );
  });

  it("marks PermanentError and unknown job types as permanent; dead logs error", async () => {
    const { sb, finishArgs } = fakeSb(
      [job("bad"), job("missing", { job_id: "j2" })],
      "dead",
    );
    const log = fakeLog();
    const w = createQueueWorker({
      sb,
      log,
      queue: "default",
      handlers: {
        bad: async () => {
          throw new PermanentError("invalid payload");
        },
      },
    });
    await w.tick();
    expect(
      finishArgs().map((a) => (a as { p_permanent: boolean }).p_permanent),
    ).toEqual([true, true]);
    expect(String((finishArgs()[1] as { p_error: string }).p_error)).toContain(
      'no handler for job type "missing"',
    );
    expect(log.error).toHaveBeenCalledTimes(2);
  });

  it("throws on claim errors so the loop applies its outage handling", async () => {
    const sb = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "fetch failed" },
      })),
    };
    const w = createQueueWorker({
      sb,
      log: fakeLog(),
      queue: "q",
      handlers: {},
    });
    await expect(w.tick()).rejects.toThrow("claim q: fetch failed");
  });

  it("logs when the finish call keeps failing", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "worker_claim_jobs"
        ? { data: [job("echo")], error: null }
        : { data: null, error: { message: "down" } },
    );
    const log = fakeLog();
    const w = createQueueWorker({
      sb: { rpc },
      log,
      queue: "q",
      handlers: { echo: async () => null },
      finishDelaysMs: [],
    });
    await w.tick();
    expect(log.error).toHaveBeenCalledWith(
      "job finish failed",
      expect.objectContaining({ err: "down" }),
    );
  });

  it("processes jobs in parallel when asked", async () => {
    const { sb } = fakeSb([job("slow"), job("slow", { job_id: "j2" })]);
    let running = 0;
    let peak = 0;
    const slow = async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    };
    const w = createQueueWorker({
      sb,
      log: fakeLog(),
      queue: "q",
      handlers: { slow },
      concurrency: "parallel",
    });
    await w.tick();
    expect(peak).toBe(2);
  });
});

describe("finishWithRetry", () => {
  it("retries until the call succeeds", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "x" } })
      .mockResolvedValueOnce({ data: "done", error: null });
    const sleep = vi.fn(async () => {});
    const res = await finishWithRetry({ rpc }, {}, { delaysMs: [1, 2], sleep });
    expect(res.data).toBe("done");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
