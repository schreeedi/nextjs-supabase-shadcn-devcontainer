## What the app does

<!-- Replace with 3–5 sentences: product, users, main flows, tiers. -->

Starter: Next.js 16 + local Supabase (Docker via CLI) + shadcn/ui, OAuth login
(Google, Facebook), protected area under `/app`.

## Where things live (don't copy it here)

| Topic                                                             | File                                     |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Setup, local Supabase, OAuth, `.env`, useful commands             | [README.md](README.md)                   |
| Deploy, proxy caching, CWV, logging/monitoring                    | [docs/deployment.md](docs/deployment.md) |
| Why things are built this way (decisions + rejected alternatives) | [docs/adr/](docs/adr/README.md)          |
| Open work (not in code comments)                                  | [ROADMAP.md](ROADMAP.md)                 |
| <!-- add rows as docs appear: roadmap, decisions, … -->           |                                          |

Keep this file short: rules and pointers. Details go into the linked docs.

## Repo map

```
app/
  (auth)/          login, signup (route group, URL without prefix)
  auth/            OAuth callback, logout, server actions (actions.ts)
  app/             signed-in area — guarded by proxy.ts
  admin/           admin console (ADMIN_USER_IDS; users, plans, queues, audit)
lib/               framework-free logic, Vitest tests (*.test.ts) next to it
  api/health/       live (process up), ready (DB + queues reachable)
  app/dashboard/   example of a plan-gated section
utils/supabase/    clients: server.ts (RSC/actions), client.ts (browser),
                   middleware.ts (session refresh + route guard),
                   service.ts (service role, server-only)
components/        app components; ui/ = generated shadcn primitives
scripts/worker.mjs background worker process (bundle: npm run build:worker)
scripts/worker/    worker logic: loop, queue consumer, monitor, plan (handlers)
supabase/          config.toml, migrations/ (run on db:start / db:reset)
proxy.ts           Next 16 middleware entry (request id, noindex, updateSession)
instrumentation.ts onRequestError → structured log
test/              cross-cutting tests (client bundle guard, migrations)
types/             database.ts (generated, npm run db:types), css.d.ts
```

## Stack & conventions

- Next 16 (App Router, Turbopack), React 19, Tailwind v4, shadcn/ui,
  Supabase via `@supabase/ssr`. Node version = devcontainer image.
- Pure calculation/format/validation logic goes framework-free into `lib/`
  with `*.test.ts` next to it. UI calls it, never duplicates it.
- Index and key access (`rows[0]`, `map[key]`) is `T | undefined` outside
  tests (`npm run typecheck:strict`; the editor doesn't show it). Order of
  remedies: restructure (`for … of`, destructure behind a check), handle the
  real gap, and only where the index provably exists use `!` — no `?? ""` as a
  dead fallback.
- Server mutations are Server Actions in `app/**/actions.ts`. Validate every
  `FormData` field — it is untrusted input (see `isOAuthProvider`).
- After a Server Action no `router.refresh()`: the action calls
  `revalidatePath` and its response already carries the new state. A refresh
  on top is a second fetch of the same page racing the first.
- Who is signed in? The proxy verifies the JWT locally (`getClaims()`).
  Pages/actions call `supabase.auth.getUser()` — `utils/supabase/server.ts`
  dedupes it to one auth round trip per request. Never trust `getSession()`
  on the server.
- Redirect targets from the URL (`?next=`) only via `safeNextPath()`; redirects
  from route handlers via `redirectToPath()` (relative `Location`, no
  origin/`x-forwarded-host` guessing) — both in `lib/nav.ts`.
- Service-role key: server-only, never `NEXT_PUBLIC_`, never in client
  components. Every table gets RLS in the same migration that creates it;
  policies use `(select auth.uid())` and `to authenticated`.
- Security headers + CSP live in `next.config.ts`. A new third-party origin
  (scripts, fetches, form redirects) must be added there, or the browser
  blocks it.
- "Today" / calendar day: derive it in the process time zone (`TZ` is set in
  the devcontainer and Vitest), never `toISOString().slice(0, 10)` (= UTC day).
- shadcn components via `npx shadcn@latest add <name>` (or the shadcn MCP);
  don't hand-edit `components/ui/` beyond small, deliberate tweaks.

## Plans & feature gates

- **One register, one decision function.** Which plan unlocks a feature lives
  only in `PLAN_FEATURES` (`lib/plan-features.ts`); every gate calls
  `planGate(plan, feature)` (`lib/plan-gate.ts`). No `plan === "pro"` checks,
  no own `isPro` lists — they drift apart.
- Every layer enforces with the same answer:
  - **UI**: `<PlanGate plan feature>` (`components/plan-gate.tsx`) shows the
    feature or an upgrade hint. UI gating is a hint, never the enforcement.
  - **Server actions**: `planGate()` → return `gate.message` as the error.
  - **API / route handlers**: `const denied = planDenied(plan, feature); if
(denied) return denied;` → 403 `{ error: { code: "plan_required", … } }`.
    One entry per endpoint (also `free`) in a min-plan table built from
    `featurePlan()`, so docs/OpenAPI can't disagree with the code.
  - **MCP**: tools call the API (never the DB directly), so they inherit its
    gate; tool descriptions use `featureNote(feature)`. The agent can do
    exactly what the user's plan can.
  - **Worker**: re-check `planGate()` when the job runs — the plan may have
    changed since it was enqueued; a lost feature is a `PermanentError`.
  - **Database**: backstop for what must hold even against a buggy server
    path — `public.plan_at_least('pro')` in RLS policies / triggers.
- Plan source: `loadPlan(db, userId)` reads `profiles.plan`; unknown/missing
  → Free (fail closed). Users can't write `plan` (column grants) — only the
  service role (billing webhook, admin).
- **Downgrade rule**: data stays. Existing records remain readable and
  deletable on every plan; creating and changing is gated.
- New plan or renamed plan: `PLANS` + the SQL check constraint +
  `plan_rank()` together — `lib/plan-features.test.ts` fails otherwise.

## Admin console (`/admin`)

- Access = auth user id listed in `ADMIN_USER_IDS` (`lib/admin.ts`); no role
  table. Empty → nobody. Non-admins get **404**, not 403.
- **Every page** under `app/admin/` starts with `await requireAdminPage()` —
  the layout check alone isn't enough (layouts don't re-run on client
  navigation; a replayed RSC request would get the page's data).
- **Every admin action** is wrapped in `adminAction()` (re-checks the admin,
  hands over the service client) and records writes with `logAdminAction()`
  in `public.admin_audit` (service role only). New action type → add it to
  `ADMIN_AUDIT_ACTIONS`. Reading another user's data is logged, not audited.
- Plan changes by hand go through `setUserPlan` — the same column billing
  writes; the user's gates (`planGate`) follow automatically.
- Add MFA (aal2) to `currentAdminId()` once the app has 2FA.

## Background work = queues

- Anything slow, retryable or not needed for the response (mails, exports,
  webhooks, third-party syncs, cleanups) is a **job**, never work inside a
  request or a fire-and-forget promise: `enqueueJob(createServiceClient(),
queue, type, payload, { userId })` (`lib/queue.ts`).
- Jobs = `public.jobs` (status, attempts, error, result; users see their own
  via RLS) + a pgmq message. Retry with backoff, dead letter after
  `max_attempts`, poison sweep — all in SQL (`worker_finish_job`).
- Handlers live in `scripts/worker/plan.mjs`, keyed by job type. Throw to
  retry, throw `PermanentError` when retrying can't help. Handlers must be
  **idempotent** — a job can run twice (lease expired, finish call lost).
  `visibilitySeconds` > slowest handler.
- New queue: `select pgmq.create('<name>');` in a migration + a loop in
  `buildPlan`. Periodic tasks are loops in `buildPlan` too (or `pg_cron`
  enqueueing jobs), not timers in the app.
- The worker is bundled with esbuild (`npm run build:worker`, TS from `lib/`
  via `@/`, npm packages external). `scripts/build-worker-bundle.test.ts`
  fails if it doesn't build or pulls in Next/`app/` — keep worker code free of
  `next/*`. Run locally: `npm run worker` (needs `SUPABASE_SERVICE_ROLE_KEY`).

## Logging & monitoring

- Log via `createLogger({ service, … })` (`lib/logger.ts`): one JSON line per
  entry, context as fields (not in the message), secrets redacted by key.
  No `console.log` in app/worker code.
- Levels mean something: `error` = someone must act (alerting counts these),
  `warn` = degraded but self-healing (retries, outage grace), `info` =
  lifecycle, `debug` = noise (off by default, `LOG_LEVEL`).
- Uncaught server errors are logged centrally in `instrumentation.ts`; every
  request carries `x-request-id` (proxy.ts).
- Health: `/api/health/live` (no dependencies), `/api/health/ready` (DB);
  public output is ok/not ok only, details go to the log. Queue backlog and
  dead jobs: worker loop `monitor:queues`. Details: docs/deployment.md.

## SEO & performance

- Public pages stay **static** (`○` in `next build`): no `cookies()` /
  `getUser()` in their render path; signed-in UI hints via
  `SignedInSwitch` (`components/signed-in.tsx`).
- Every public page exports `metadata` with `title` (≤ 60 chars, the layout
  adds "– Site"), `description` (≤ 160) and `alternates.canonical`. Never a
  canonical in a layout. New public page → entry in `app/sitemap.ts`.
- Non-public areas are `robots: { index: false }` (`app/app/layout.tsx`,
  `app/(auth)/layout.tsx`) and disallowed in `app/robots.ts`.
- Structured data via `<JsonLd>` (`components/json-ld.tsx`), never a raw
  `dangerouslySetInnerHTML`.
- CWV: above-the-fold on the server; heavy client libs via `await import()`
  / `next/dynamic`; Suspense fallbacks with the final size (CLS);
  `prefetch={false}` for links into `/app`. Measure with Lighthouse against
  `npm run build && npm start`.

## Database

- Schema only through migrations: `npx supabase migration new <name>` (real
  timestamp, not "last + 1"). They run automatically on `db:start` /
  `db:reset`.
- After every new migration: `npm run db:reset && npm run db:types` →
  `types/database.ts`. Commit both together.
- Every Supabase client is typed (`<Database>`, `SupabaseClient<Database>`
  in `lib/`). No `as` casts on query results — a cast hides schema drift;
  regenerate the types instead.
- `supabase/config.toml` changed → `npm run db:stop && npm run db:start`.
- Check RLS/performance with the Supabase MCP advisors (`get_advisors`) after
  schema changes.
- Grants are a lock of their own, not "covered by RLS": revoke what the API
  roles must never do (INSERT/DELETE/TRUNCATE, protected columns) in the same
  migration, and assert it in `supabase/tests/database/privileges.test.sql`.
- Functions in `public` are `security invoker` unless they must bypass RLS;
  definer functions get `set search_path = ''` and `revoke execute … from
public, anon, authenticated`.

## Working rules

- **Check before done**: `npm run check` (format, lint, typecheck, strict
  typecheck, tests). Router/Server-Action/streaming behaviour: verify against
  `npm run build && npm start` too — dev and production builds differ.
- **Tests — pick the lowest level that can catch the bug:**
  1. Unit (Vitest, `*.test.ts` next to the code): logic with branches and
     edge cases, worker handlers with fake clients. Not for trivial wrappers.
  2. Static/meta tests (`test/`): import graph (client bundle guard),
     migration names, worker bundle — cheap guards against whole classes of
     mistakes; add one when a mistake could recur.
  3. DB tests against the local stack (pgTAP, `supabase/tests/database/`,
     `npm run db:test`): RLS (user B must not read/write user A's rows),
     grants, SQL functions, triggers.
  4. E2E (Playwright, when added): user flows across pages, against a
     production build.
- **TDD for bugs and specified behaviour**: write the failing test first,
  from the spec/expected behaviour — not from what the code currently does.
  If the code disagrees, the code is wrong; never bend the assertion.
- **UI work**: render it and look at it (browser/screenshot), don't accept a
  layout on paper.
- **Done means committed** — with the docs that changed along with it
  (Conventional Commits: `feat(scope): …`, `fix: …`, `docs: …`).
- **Name new migrations and new env vars** in the commit/PR — they have to be
  applied/set manually in other environments. New env var → also into
  `.env.local.example` (or `.env.example` for `supabase start`).
- **Security review before main**: run the `security-review` skill over the
  branch, fix or report findings, then
  `.claude/hooks/security-review-gate.sh mark`. The PreToolUse hook blocks
  `git push … main` / `gh pr merge` until the reviewed HEAD is marked.
- **Architecture decisions → ADR** (`docs/adr/`, template + rules in its
  README): new technology/service, a pattern every feature must follow, a
  deliberate non-choice, or deviating from an earlier ADR. Read the ADRs
  before changing queues, plan gating or caching — and don't "fix" a
  documented decision without a new ADR that supersedes it.
- Open work goes into a `ROADMAP.md` / `TODO.md`, not into code comments.

## Skills & MCP

- Skills (`.claude/skills/`): `supabase`, `supabase-postgres-best-practices`
  (update: `npx skills update -p`), `next-best-practices`,
  `react-best-practices`. Use them when touching the matching area.
- MCP (`.mcp.json`): `next-devtools` (running dev server: errors, routes),
  `supabase` (local stack on :54321 — schema, SQL, advisors, docs), `shadcn`
  (component registry).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
