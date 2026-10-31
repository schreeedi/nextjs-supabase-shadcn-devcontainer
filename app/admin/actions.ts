"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin";
import { adminAction, logAdminAction } from "@/lib/admin-session";
import { normalizePlan, PLANS, type Plan } from "@/lib/plan-features";

export type AdminActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Change a user's plan by hand (support, tests). Billing webhooks write the same column. */
export const setUserPlan = adminAction(
  async (
    { adminId, svc },
    _prev: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> => {
    const userId = formData.get("userId");
    const rawPlan = formData.get("plan");
    if (!isUuid(userId)) return { ok: false, error: "Invalid user id." };
    if (!PLANS.includes(rawPlan as Plan)) {
      return { ok: false, error: "Unknown plan." };
    }
    const plan = normalizePlan(rawPlan);

    const { data: before } = await svc
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle<{ plan: string }>();
    if (!before) return { ok: false, error: "User has no profile." };
    if (before.plan === plan) return { ok: true, message: "Plan unchanged." };

    const { error } = await svc
      .from("profiles")
      .update({ plan })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };

    await logAdminAction(svc, {
      adminId,
      targetUserId: userId,
      action: "plan_change",
      detail: { from: before.plan, to: plan },
    });
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath("/admin");
    return { ok: true, message: `Plan changed to ${plan}.` };
  },
);
