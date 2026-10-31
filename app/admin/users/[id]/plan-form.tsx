"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { setUserPlan, type AdminActionState } from "@/app/admin/actions";
import { PLAN_LABELS, PLANS, type Plan } from "@/lib/plan-features";

export function PlanForm({ userId, plan }: { userId: string; plan: Plan }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    setUserPlan,
    { ok: true },
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor="plan" className="text-sm font-medium">
        Plan
      </label>
      <NativeSelect id="plan" name="plan" defaultValue={plan}>
        {PLANS.map((p) => (
          <NativeSelectOption key={p} value={p}>
            {PLAN_LABELS[p]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
    </form>
  );
}
