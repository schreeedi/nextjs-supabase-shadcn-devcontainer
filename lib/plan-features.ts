// Plans and the feature register: the minimum plan of every feature, in
// exactly one place (why: docs/adr/002-single-plan-feature-register.md).
// Everything that gates by plan reads from here —
//   • UI hints and gated sections (components/plan-gate.tsx),
//   • server actions and route handlers (planGate in lib/plan-gate.ts),
//   • the public API / OpenAPI / MCP tool descriptions (featureNote),
//   • worker handlers (re-check at run time — the plan may have changed),
//   • pricing/marketing tables.
// The database knows the same plan names (profiles.plan check constraint,
// public.plan_rank) as a backstop; lib/plan-features.test.ts keeps both in sync.
//
// New feature: add a key here, gate with planGate()/<PlanGate>, done. A
// feature changes plan → change `minPlan` only.

/** Ordered from lowest to highest. Same order as public.plan_rank(). */
export const PLANS = ["free", "pro", "business"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

type FeatureDef = {
  /** Lowest plan that includes the feature. */
  minPlan: Plan;
  /** Display name in hints and errors ("Data export is available from Pro."). */
  label: string;
};

export const PLAN_FEATURES = {
  // Examples — replace with the product's real features.
  dashboard: { minPlan: "free", label: "Dashboard" },
  dataExport: { minPlan: "pro", label: "Data export" },
  api: { minPlan: "business", label: "API access" },
} as const satisfies Record<string, FeatureDef>;

export type FeatureKey = keyof typeof PLAN_FEATURES;

/** Anything not a known plan (missing row, typo, old value) counts as Free. */
export function normalizePlan(value: unknown): Plan {
  return PLANS.includes(value as Plan) ? (value as Plan) : "free";
}

export function planAtLeast(plan: Plan, min: Plan): boolean {
  return PLANS.indexOf(plan) >= PLANS.indexOf(min);
}

export function hasFeature(plan: Plan, key: FeatureKey): boolean {
  return planAtLeast(plan, PLAN_FEATURES[key].minPlan);
}

export function featurePlan(key: FeatureKey): Plan {
  return PLAN_FEATURES[key].minPlan;
}

export function featureLabel(key: FeatureKey): string {
  return PLAN_FEATURES[key].label;
}

/** User-facing message when the plan lacks a feature. */
export function featurePlanError(key: FeatureKey): string {
  return `${featureLabel(key)} is available from the ${PLAN_LABELS[featurePlan(key)]} plan.`;
}

/** Short note for API docs, OpenAPI `description`s and MCP tool descriptions. */
export function featureNote(key: FeatureKey): string {
  const min = featurePlan(key);
  return min === "free"
    ? "Available on every plan."
    : `Requires the ${PLAN_LABELS[min]} plan or higher.`;
}
