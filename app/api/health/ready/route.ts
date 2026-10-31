import { createServiceClient } from "@/utils/supabase/service";
import { createLogger } from "@/lib/logger";

// Readiness: can this instance serve traffic? Checks the database (and with
// it pgmq) via queue_health(). Public output is only ok/not ok per check —
// error details go to the log, never to an anonymous caller.
export const dynamic = "force-dynamic";

const log = createLogger({ service: "app", action: "health:ready" });

async function checkDatabase(): Promise<boolean> {
  try {
    const { error } = await createServiceClient().rpc("queue_health");
    if (error) log.error("database check failed", { err: error.message });
    return !error;
  } catch (err) {
    log.error("database check threw", { err });
    return false;
  }
}

export async function GET() {
  const checks = { database: await checkDatabase() };
  const ok = Object.values(checks).every(Boolean);
  return Response.json(
    { status: ok ? "ok" : "degraded", checks },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
