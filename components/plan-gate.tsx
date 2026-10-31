import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planGate } from "@/lib/plan-gate";
import { PLAN_LABELS, type FeatureKey, type Plan } from "@/lib/plan-features";

/**
 * Renders `children` when the plan includes the feature, otherwise an upgrade
 * hint. UI only — the server action / API behind the feature must check
 * planGate() itself; hiding a button is never the enforcement.
 */
export function PlanGate({
  plan,
  feature,
  children,
}: {
  plan: Plan;
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const gate = planGate(plan, feature);
  if (gate.ok) return children;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Lock className="h-4 w-4" aria-hidden="true" />
        {gate.message}
      </span>
      <Button size="sm" variant="outline" asChild>
        {/* Point this at the billing page once it exists. */}
        <Link href="/app/dashboard" prefetch={false}>
          Upgrade to {PLAN_LABELS[gate.minPlan]}
        </Link>
      </Button>
    </div>
  );
}
