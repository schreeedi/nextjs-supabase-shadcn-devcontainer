# Next.js + Supabase (local Docker) + Shadcn UI — Devcontainer

A ready-to-run Next.js 16 app with a **fully local Supabase stack running in Docker**:

- **Supabase local stack** (Postgres, Auth, PostgREST, Storage, Studio) via Supabase CLI
- **Google OAuth** + **Facebook OAuth** login (OAuth only — email/password signup is off)
- **Shadcn UI** (new-york, v4) + Tailwind CSS v4, light/dark mode via next-themes
- **Plans & feature gates** (Free/Pro/Business) from one register, enforced in UI, actions, API, worker and DB
- **Admin console** (`/admin`, `ADMIN_USER_IDS`) with audited actions
- **Background jobs** on Supabase Queues (pgmq) + a bundled **worker** process
- Structured JSON logging, health endpoints, queue monitoring
- Security headers/CSP, open-redirect-safe auth flow, RLS-first schema with locked-down grants
- SEO basics (metadata, robots, sitemap, JSON-LD, icon/OG image), static landing page
- Tests on every level: **Vitest** (unit/static), **pgTAP** (RLS, grants), **Playwright** user journeys
- ESLint (flat config) + Prettier + strict typecheck (`npm run check`)
- Devcontainer with **docker-in-docker**; agent setup (AGENTS.md, ADRs, skills, MCP, agent-browser)

## Do we need Docker Compose?

No — not one you write yourself. The **Supabase CLI** (`supabase start`) orchestrates all ~10 Supabase containers internally. The devcontainer uses the **docker-in-docker** feature so those containers run inside your devcontainer.

> Hand-written `docker-compose.yml` (from Supabase's [self-hosting repo](https://github.com/supabase/supabase/tree/master/docker)) is only needed for **production self-hosting**. For local dev, the CLI gives you the same stack plus migrations, seeding, type generation, and Studio — with far less config.

---

## Quick start

```bash
# 1. Open in VS Code → "Reopen in Container"
#    (post-create installs npm deps, Supabase CLI and Chromium for E2E;
#     post-start boots the Supabase Docker stack and fills .env.local keys)

# 2. Configure OAuth secrets for the local stack
cp .env.example .env          # fill in Google/Facebook client IDs + secrets

# 3. Start Next.js
npm run dev
```

| Service         | URL                    |
| --------------- | ---------------------- |
| Next.js app     | http://localhost:3000  |
| Supabase API    | http://localhost:54321 |
| Supabase Studio | http://localhost:54323 |
| Postgres        | localhost:54322        |
| Mailpit (mail)  | http://localhost:54324 |

`.env.local` is auto-created from `.env.local.example`; on every container start `scripts/local-env.sh` fills in the local Supabase keys from `supabase status` (only empty values — yours are never overwritten). Nothing to change for local dev. After `supabase start` outside the container: `npm run env:local`.

No key is committed, not even the well-known local defaults: GitHub push protection rejects `sb_secret_…` in any file.

Admin console: sign in once, copy your user id (Studio → Authentication) into
`ADMIN_USER_IDS` in `.env.local`, restart `npm run dev`, open `/admin`.

---

## OAuth setup (local)

The **redirect URI is different for local dev** — it points at your local Kong gateway:

```
http://localhost:54321/auth/v1/callback
```

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → Credentials → OAuth 2.0 Client ID (Web).
2. Add authorized redirect URI: `http://localhost:54321/auth/v1/callback`
3. Put Client ID + Secret in `.env`:
   ```env
   SUPABASE_AUTH_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_GOOGLE_SECRET=...
   ```

### Facebook

1. [Meta for Developers](https://developers.facebook.com) → Create App → add the **Facebook Login** product.
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `http://localhost:54321/auth/v1/callback`
3. App settings → Basic → copy **App ID** and **App Secret**.
4. Put values in `.env`:
   ```env
   SUPABASE_AUTH_FACEBOOK_CLIENT_ID=...
   SUPABASE_AUTH_FACEBOOK_SECRET=...
   ```

Both providers are already enabled in `supabase/config.toml`. Restart the stack after editing `.env`:

```bash
npx supabase stop && npx supabase start
```

> **Tip:** You can register both the local (`http://localhost:54321/...`) and production (`https://<your-supabase-domain>/auth/v1/callback`) redirect URIs in the _same_ Google/Facebook app — no need for separate apps.

---

## Useful commands

```bash
npm run check         # format check + lint + typecheck (+ strict) + tests — before every commit
npm test              # Vitest (npm run test:watch, npm run test:coverage)
npm run format        # Prettier (incl. Tailwind class sorting)
npm run worker        # bundle + start the background worker (needs SUPABASE_SERVICE_ROLE_KEY)
npm run db:start      # supabase start  — boot the Docker stack
npm run db:stop       # supabase stop   — stop containers (data persists)
npm run db:reset      # wipe DB + re-run migrations + seed
npm run db:status     # show URLs + keys
npm run db:types      # generate types/database.ts from the local schema
npm run env:local     # fill local Supabase keys into .env.local (supabase status)
npm run db:test       # pgTAP tests in supabase/tests (RLS, grants) against the local stack
npm run test:e2e      # Playwright journeys against a prod build on :3100 (needs the stack)
npm run browser -- open http://localhost:3000   # agent-browser (screenshots: … screenshot out.png)
npx supabase migration new <name>   # new migration with a real timestamp
```

## Migrations

SQL files in `supabase/migrations/` run automatically on `supabase start` / `db reset`:

- `*_profiles.sql` — `public.profiles` linked to `auth.users`; RLS (users
  read/update only their own row); grants keep `plan`, `email` and row
  creation/deletion out of users' reach; triggers create the profile on
  signup (incl. OAuth `full_name`/`avatar_url`) and follow email changes;
  `plan_rank()` / `plan_at_least()` as the database backstop for plan gates.
- `*_job_queue.sql` — `public.jobs` + pgmq with `enqueue_job` /
  `worker_claim_jobs` / `worker_finish_job` (retry with backoff, dead letter,
  poison sweep) and `queue_health` for monitoring.
- `*_admin_audit.sql` — `public.admin_audit`, service role only.

`supabase/tests/database/` (pgTAP, `npm run db:test`) asserts the grants and
RLS with two users. New migration → `npm run db:reset && npm run db:types`.

## Tests

| Level        | Where                           | Run                                  |
| ------------ | ------------------------------- | ------------------------------------ |
| Unit, static | `**/*.test.ts`, `test/`         | `npm test` (part of `npm run check`) |
| Database     | `supabase/tests/database/`      | `npm run db:test` (needs the stack)  |
| E2E journeys | `e2e/` (Playwright, prod build) | `npm run test:e2e` (needs the stack) |

E2E signs in without OAuth: the setup creates test users and redeems a
service-role magic link ([ADR-004](docs/adr/004-e2e-sessions-via-magic-link.md)).
To look at a page yourself or let an agent screenshot it:
`npm run browser -- open http://localhost:3000`, then `npm run browser -- screenshot out.png`.

## Background jobs

```ts
// server action / route handler
import { createServiceClient } from "@/utils/supabase/service";
import { enqueueJob } from "@/lib/queue";

await enqueueJob(
  createServiceClient(),
  "default",
  "example.echo",
  { hello: 1 },
  { userId: user.id },
);
```

The worker (`npm run worker`, separate process) claims jobs and runs the
handler registered for the job type in `scripts/worker/plan.mjs`. Rules
(idempotency, permanent errors, new queues): [AGENTS.md](AGENTS.md) →
"Background work = queues". Deploy/proxy/monitoring notes:
[docs/deployment.md](docs/deployment.md).

---

## Project structure

```
.devcontainer/
  devcontainer.json          # Node 26 + docker-in-docker + port forwards
  post-create.sh             # npm install, Chromium, project_id from folder name, .env.local
  post-start.sh              # starts the Supabase stack, fills .env.local keys
.claude/                     # skills, security-review gate hook
AGENTS.md / CLAUDE.md        # agent instructions (CLAUDE.md imports AGENTS.md)
ROADMAP.md                   # open work
.mcp.json                    # next-devtools, supabase (local), shadcn
supabase/
  config.toml                # Local stack config incl. Google/Facebook OAuth
  migrations/                # SQL migrations (auto-applied)
  tests/database/            # pgTAP: grants, RLS with two users
app/
  (auth)/login, (auth)/signup  # OAuth sign-in pages
  auth/callback/route.ts     # OAuth code exchange
  auth/logout/route.ts       # POST only
  app/dashboard/             # Protected area (everything under /app requires login)
  admin/                     # Admin console (ADMIN_USER_IDS)
  api/health/{live,ready}    # health endpoints
  not-found, error, global-error  # error boundaries
  icon.tsx, opengraph-image.tsx   # generated favicon / share image
  robots.ts, sitemap.ts      # SEO (runtime env)
  globals.css                # Tailwind v4 CSS-first config + Shadcn theme (OKLCH)
proxy.ts                     # Request id, noindex, session refresh + route guard
instrumentation.ts           # onRequestError → structured log
utils/supabase/              # browser/server/middleware/service clients (typed)
components/                  # app components (plan gate, theme toggle, …)
components/ui/               # Shadcn components (generated)
lib/                         # Framework-free logic + Vitest unit tests
types/database.ts            # generated from the local schema (npm run db:types)
scripts/worker.mjs           # Background worker entry (bundled by scripts/build-worker-bundle.mjs)
scripts/worker/              # loop, queue consumer, monitor, plan (job handlers)
scripts/local-env.sh         # local Supabase keys → .env.local
scripts/agent-browser.sh     # agent-browser on Playwright's Chromium
test/                        # Cross-cutting tests (bundle guard, migrations, ADRs, no committed keys)
e2e/                         # Playwright user journeys + test-user setup
docs/adr/                    # Architecture decisions
docs/deployment.md           # Proxy caching, CWV, logging & monitoring best practices
.env.example                 # OAuth secrets for local Supabase stack
.env.local.example           # Next.js env (keys filled in by scripts/local-env.sh)
```

## Production: self-hosted Supabase

Production runs Supabase from its [Docker setup](https://supabase.com/docs/guides/self-hosting/docker)
(`supabase/docker`), not Supabase Cloud. `supabase/config.toml` configures
**only the local CLI stack** — production auth is configured through the
self-hosting `.env` / `docker-compose.yml`, so mirror it there:

1. Auth in the self-hosting `.env` — its defaults are **more open** than this
   app wants:

   ```bash
   DISABLE_SIGNUP=false            # OAuth sign-ups must still work
   ENABLE_EMAIL_SIGNUP=false       # default true — pre-account takeover of OAuth users
   ENABLE_EMAIL_AUTOCONFIRM=false
   ENABLE_PHONE_SIGNUP=false       # default true, with autoconfirm on
   ENABLE_ANONYMOUS_USERS=false
   SITE_URL=https://your-domain.com
   ADDITIONAL_REDIRECT_URLS=https://your-domain.com/auth/callback
   ```

2. Google/Facebook: add `GOTRUE_EXTERNAL_GOOGLE_{ENABLED,CLIENT_ID,SECRET,REDIRECT_URI}`
   (same for `FACEBOOK`) to the `auth` service in `docker-compose.yml`
   ([self-hosted OAuth](https://supabase.com/docs/guides/self-hosting/self-hosted-oauth));
   the redirect URI is `https://<your-supabase-domain>/auth/v1/callback`.
3. Migrations: `npx supabase db push --db-url "postgresql://postgres:<password>@<db-host>:5432/postgres"`.
4. App env: see the production block in `.env.local.example` and
   [docs/deployment.md](docs/deployment.md).
