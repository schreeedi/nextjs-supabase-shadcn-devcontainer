// Enqueue background jobs (public.jobs + pgmq, consumed by scripts/worker.mjs).
// Framework-free: callers pass a service-role client
// (utils/supabase/service.ts) — enqueue_job is not callable with a user session.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EnqueueOptions = {
  /** Owner — lets the user see the job's status through RLS. */
  userId?: string;
  /** Start no earlier than this many seconds from now. */
  delaySeconds?: number;
  /** Attempts before the job goes to the dead letter (default 5). */
  maxAttempts?: number;
};

/** Returns the job id. Throws if the queue doesn't exist or the call fails. */
export async function enqueueJob(
  service: SupabaseClient,
  queue: string,
  type: string,
  payload: Record<string, unknown> = {},
  { userId, delaySeconds = 0, maxAttempts = 5 }: EnqueueOptions = {},
): Promise<string> {
  const { data, error } = await service.rpc("enqueue_job", {
    p_queue: queue,
    p_type: type,
    p_payload: payload,
    p_user_id: userId ?? null,
    p_delay_seconds: delaySeconds,
    p_max_attempts: maxAttempts,
  });
  if (error) throw new Error(`enqueue ${queue}/${type}: ${error.message}`);
  return data as string;
}
