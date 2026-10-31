import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/queue";

const client = (res: { data: unknown; error: { message: string } | null }) => {
  const rpc = vi.fn(async () => res);
  return { service: { rpc } as unknown as SupabaseClient, rpc };
};

describe("enqueueJob", () => {
  it("calls enqueue_job with defaults and returns the job id", async () => {
    const { service, rpc } = client({ data: "job-1", error: null });
    await expect(enqueueJob(service, "default", "mail.send")).resolves.toBe(
      "job-1",
    );
    expect(rpc).toHaveBeenCalledWith("enqueue_job", {
      p_queue: "default",
      p_type: "mail.send",
      p_payload: {},
      p_user_id: null,
      p_delay_seconds: 0,
      p_max_attempts: 5,
    });
  });

  it("passes owner, delay and attempts", async () => {
    const { service, rpc } = client({ data: "job-2", error: null });
    await enqueueJob(
      service,
      "default",
      "x",
      { a: 1 },
      {
        userId: "u1",
        delaySeconds: 30,
        maxAttempts: 2,
      },
    );
    expect(rpc).toHaveBeenCalledWith(
      "enqueue_job",
      expect.objectContaining({
        p_user_id: "u1",
        p_delay_seconds: 30,
        p_max_attempts: 2,
      }),
    );
  });

  it("throws with queue and type on errors", async () => {
    const { service } = client({
      data: null,
      error: { message: "unknown queue nope" },
    });
    await expect(enqueueJob(service, "nope", "x")).rejects.toThrow(
      "enqueue nope/x: unknown queue nope",
    );
  });
});
