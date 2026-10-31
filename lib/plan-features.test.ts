import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  featureNote,
  featurePlanError,
  hasFeature,
  normalizePlan,
  planAtLeast,
  PLAN_FEATURES,
  PLAN_LABELS,
  PLANS,
} from "@/lib/plan-features";
import { loadPlan, PLAN_REQUIRED, planDenied, planGate } from "@/lib/plan-gate";

describe("plans", () => {
  it("orders plans and compares them", () => {
    expect(planAtLeast("business", "pro")).toBe(true);
    expect(planAtLeast("pro", "pro")).toBe(true);
    expect(planAtLeast("free", "pro")).toBe(false);
  });

  it("treats unknown values as free", () => {
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("PRO")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan(undefined)).toBe("free");
  });

  it("has a label for every plan", () => {
    for (const p of PLANS) expect(PLAN_LABELS[p]).toBeTruthy();
  });
});

describe("feature register", () => {
  it("every feature has a known plan and a label", () => {
    for (const [key, def] of Object.entries(PLAN_FEATURES)) {
      expect(PLANS, key).toContain(def.minPlan);
      expect(def.label.trim(), key).not.toBe("");
    }
  });

  it("hasFeature follows minPlan", () => {
    expect(hasFeature("free", "dashboard")).toBe(true);
    expect(hasFeature("free", "dataExport")).toBe(false);
    expect(hasFeature("pro", "dataExport")).toBe(true);
    expect(hasFeature("pro", "api")).toBe(false);
  });

  it("builds messages and notes from the register", () => {
    expect(featurePlanError("dataExport")).toBe(
      "Data export is available from the Pro plan.",
    );
    expect(featureNote("api")).toBe("Requires the Business plan or higher.");
    expect(featureNote("dashboard")).toBe("Available on every plan.");
  });
});

describe("planGate / planDenied", () => {
  it("allows included features", () => {
    expect(planGate("pro", "dataExport")).toEqual({ ok: true });
    expect(planDenied("business", "api")).toBeNull();
  });

  it("denies with one shape for UI, API and MCP", async () => {
    expect(planGate("free", "dataExport")).toEqual({
      ok: false,
      code: PLAN_REQUIRED,
      feature: "dataExport",
      label: "Data export",
      minPlan: "pro",
      message: "Data export is available from the Pro plan.",
    });
    const res = planDenied("free", "api")!;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: PLAN_REQUIRED,
        feature: "api",
        label: "API access",
        minPlan: "business",
        message: "API access is available from the Business plan.",
      },
    });
  });
});

describe("loadPlan", () => {
  const db = (result: { data: unknown; error?: unknown }) =>
    ({
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => result }) }),
      })),
    }) as unknown as SupabaseClient;

  it("reads profiles.plan", async () => {
    await expect(
      loadPlan(db({ data: { plan: "business" } }), "u"),
    ).resolves.toBe("business");
  });

  it("fails closed to free on missing row or error", async () => {
    await expect(loadPlan(db({ data: null }), "u")).resolves.toBe("free");
    await expect(
      loadPlan(db({ data: null, error: { message: "down" } }), "u"),
    ).resolves.toBe("free");
  });
});

// The database backstop must know exactly the same plans in the same order.
describe("SQL plan names match PLANS", () => {
  const dir = join(import.meta.dirname, "..", "supabase", "migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

  it("profiles.plan check constraint lists PLANS", () => {
    const m =
      /plan text not null default 'free' check \(plan in \(([^)]*)\)\)/.exec(
        sql,
      );
    expect(m, "check constraint on profiles.plan").not.toBeNull();
    expect(m![1]!.split(",").map((s) => s.trim().replace(/'/g, ""))).toEqual([
      ...PLANS,
    ]);
  });

  it("plan_rank() ranks PLANS in order", () => {
    const fn = sql.slice(sql.lastIndexOf("function public.plan_rank"));
    const ranked = [...fn.matchAll(/when '([a-z]+)' then (\d+)/g)].map(
      ([, name, rank]) => [name, Number(rank)],
    );
    expect(ranked).toEqual(PLANS.map((p, i) => [p, i]));
  });
});
