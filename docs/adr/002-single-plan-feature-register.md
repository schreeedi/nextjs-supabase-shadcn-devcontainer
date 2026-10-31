# ADR-002: One plan/feature register, one gate function

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Paid plans gate features in many places: UI hints, server actions, the
public API, MCP tools (via the API), background jobs and database rules.
Scattered `plan === "pro"` checks drift apart — a feature shows as locked in
the UI but works through the API, or the pricing page promises what the code
blocks. Moving a feature to another plan then means hunting for every check.

## Decision

- `PLAN_FEATURES` in `lib/plan-features.ts` is the **only** place that maps a
  feature to its minimum plan.
- `planGate(plan, feature)` in `lib/plan-gate.ts` is the **only** decision
  function. UI (`<PlanGate>`), actions, API (`planDenied` → 403
  `plan_required`), MCP tool descriptions (`featureNote`) and worker handlers
  all use it, so the same plan gets the same answer and message everywhere.
- The database knows the same plan names (`profiles.plan` check constraint,
  `plan_rank()`, `plan_at_least()`) as a backstop for rules that must hold
  even against a buggy server path. `lib/plan-features.test.ts` keeps
  TypeScript and SQL in sync.
- `profiles.plan` is writable only by the service role (billing, admin);
  unknown or missing values count as Free (fail closed).

## Alternatives considered

- **Per-feature boolean flags on the profile** — flexible, but the "which
  plan includes what" rule then lives in billing code and drifts from the UI.
- **Entitlements service / feature-flag SaaS** — useful for many plans,
  add-ons and experiments; overkill and an extra dependency for 2–4 plans.
- **Checks only in the database (RLS/triggers)** — robust, but error messages
  and UI hints would need a second source of truth anyway.

## Consequences

- Changing a feature's plan is a one-line change in the register.
- Every new gated feature needs a register key; reviewers reject ad-hoc plan
  comparisons.
- Downgrades keep data readable and deletable; only creating/changing is
  gated (rule in AGENTS.md).
- Revisit when add-ons, per-seat limits or usage quotas appear — the register
  may then grow into an entitlements model (limits, not just booleans).
