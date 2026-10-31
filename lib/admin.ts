// Admin access without a role system: the authorised auth user ids are listed
// in ADMIN_USER_IDS (comma-separated). Empty / unset → nobody is admin, the
// admin area is effectively off. Framework-free.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function adminUserIds(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isUuid);
}

export function isAdmin(
  userId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !!userId && adminUserIds(env).includes(userId.toLowerCase());
}

/** Write actions recorded in public.admin_audit. Extend as the console grows. */
export const ADMIN_AUDIT_ACTIONS = ["plan_change"] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];
