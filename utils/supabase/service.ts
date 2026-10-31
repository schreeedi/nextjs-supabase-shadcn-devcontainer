import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client — bypasses RLS. Server-only (the import above fails the
 * build if a client component pulls this in). Use it only for what a user
 * session can't do (enqueueing jobs, admin tasks) and scope every query by the
 * user id yourself.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and a Supabase URL) must be set for server-side jobs.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
