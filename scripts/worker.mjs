// Background worker process: consumes the job queues (public.jobs + pgmq) and
// runs periodic tasks. Separate process from Next — long-running work never
// blocks a request, and the worker scales/restarts on its own.
//
// This file is only the process: read env, build the client, handle signals,
// start the loops. The logic lives testable under scripts/worker/.
//
// Runs as a bundle, not directly (scripts/build-worker-bundle.mjs →
// dist/worker/worker.mjs): modules here load TypeScript from lib/ via the
// "@/…" alias, which plain `node` can't resolve. `npm run worker` builds and
// starts it.

import { createClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import { createStopper, runPlan } from "./worker/loop.mjs";
import { buildPlan } from "./worker/plan.mjs";

const log = createLogger({ service: process.env.LOG_SERVICE || "worker" });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  log.error(
    "SUPABASE_SERVICE_ROLE_KEY and a Supabase URL must be set — exiting.",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stopper = createStopper();
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    log.info(`${sig} — stopping after the current batch`);
    stopper.stop();
  });
}

const plan = buildPlan({ sb, log, env: process.env });
log.info("worker started", { loops: plan.map((l) => l.name) });

await runPlan(plan, {
  isStopped: stopper.isStopped,
  sleep: stopper.sleep,
  log,
});
log.info("worker stopped");
process.exit(0);
