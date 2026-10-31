import "server-only";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { isAdmin, type AdminAuditAction } from "@/lib/admin";
import { createLogger } from "@/lib/logger";

/** Id of the signed-in admin, or null. */
export async function currentAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Add an MFA requirement here (aal2) once the app offers 2FA — the console
  // acts on other users' accounts; a password alone shouldn't be enough.
  return user && isAdmin(user.id) ? user.id : null;
}

/**
 * Call at the top of EVERY page under /admin, not only in the layout: Next
 * doesn't re-render a layout on client navigation / RSC requests, so a check
 * in the layout alone lets anyone who replays the request read the page's
 * data. Non-admins get a 404 — the area doesn't reveal it exists.
 */
export async function requireAdminPage(): Promise<string> {
  const adminId = await currentAdminId();
  if (!adminId) notFound();
  return adminId;
}

export type AdminCtx = { adminId: string; svc: SupabaseClient };
export type AdminActionFail = { ok: false; error: string };

export const NOT_ADMIN = "Not authorised.";

/**
 * Standard shape of an admin server action: re-checks the admin (actions are
 * plain POST endpoints, reachable without the page), then runs the handler
 * with the service client.
 */
export function adminAction<A extends unknown[], R>(
  handler: (ctx: AdminCtx, ...args: A) => Promise<R>,
): (...args: A) => Promise<R | AdminActionFail> {
  return async (...args: A) => {
    const adminId = await currentAdminId();
    if (!adminId) return { ok: false, error: NOT_ADMIN };
    return handler({ adminId, svc: createServiceClient() }, ...args);
  };
}

/**
 * Record an admin write action in public.admin_audit (and the log). Doesn't
 * throw: a failing audit insert is logged as error but must not undo the
 * support action that already happened.
 */
export async function logAdminAction(
  svc: SupabaseClient,
  entry: {
    adminId: string;
    targetUserId: string | null;
    action: AdminAuditAction;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  const log = createLogger({ service: "app", action: "admin:audit" });
  const { error } = await svc.from("admin_audit").insert({
    admin_id: entry.adminId,
    target_user_id: entry.targetUserId,
    action: entry.action,
    detail: entry.detail ?? {},
  });
  if (error) {
    log.error("admin audit insert failed", {
      err: error.message,
      auditAction: entry.action,
    });
    return;
  }
  log.info("admin action", {
    adminId: entry.adminId,
    targetUserId: entry.targetUserId,
    auditAction: entry.action,
  });
}
