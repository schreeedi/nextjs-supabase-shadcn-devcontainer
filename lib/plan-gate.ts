// The one decision function for plan limits. UI, server actions, route
// handlers (API), MCP tools and worker handlers all call planGate() — so the
// same plan gets the same answer and the same error everywhere.
// Framework-free; loadPlan() works with any Supabase client (session,
// service role, worker).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  featureLabel,
  featurePlan,
  featurePlanError,
  hasFeature,
  normalizePlan,
  type FeatureKey,
  type Plan,
} from "@/lib/plan-features";

/** Stable machine-readable code for clients (API, MCP, UI). */
export const PLAN_REQUIRED = "plan_required";

export type PlanGateResult =
  | { ok: true }
  | {
      ok: false;
      code: typeof PLAN_REQUIRED;
      feature: FeatureKey;
      label: string;
      minPlan: Plan;
      message: string;
    };

export function planGate(plan: Plan, feature: FeatureKey): PlanGateResult {
  if (hasFeature(plan, feature)) return { ok: true };
  return {
    ok: false,
    code: PLAN_REQUIRED,
    feature,
    label: featureLabel(feature),
    minPlan: featurePlan(feature),
    message: featurePlanError(feature),
  };
}

/**
 * Route handlers / API: 403 with the same body for every gated endpoint.
 * `null` when allowed — `const denied = planDenied(plan, "api"); if (denied) return denied;`
 */
export function planDenied(plan: Plan, feature: FeatureKey): Response | null {
  const gate = planGate(plan, feature);
  if (gate.ok) return null;
  const { ok: _ok, ...body } = gate;
  return Response.json(
    { error: body },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Plan of a user from `profiles.plan`. Missing row or read error → Free —
 * failing closed: a broken read never unlocks a paid feature.
 */
export async function loadPlan(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<Plan> {
  const { data } = await db
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  return normalizePlan(data?.plan);
}
