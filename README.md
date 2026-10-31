# Next.js + Supabase (local Docker) + Shadcn UI — Devcontainer

A ready-to-run Next.js 16 app with a **fully local Supabase stack running in Docker**:

- **Supabase local stack** (Postgres, Auth, PostgREST, Storage, Studio) via Supabase CLI
- **Google OAuth** + **Facebook OAuth** login
- **Shadcn UI** + Tailwind CSS v4
- **Background jobs** on Supabase Queues (pgmq) + a bundled **worker** process
- Structured JSON logging, health endpoints, queue monitoring
- Security headers/CSP, open-redirect-safe auth flow, RLS-first schema
- SEO basics (metadata, robots, sitemap, JSON-LD), static landing page
- **Vitest** unit tests + ESLint (flat config) + Prettier + strict typecheck (`npm run check`)
- Devcontainer with **docker-in-docker**; agent setup (AGENTS.md, skills, MCP)

## Do we need Docker Compose?

No — not one you write yourself. The **Supabase CLI** (`supabase start`) orchestrates all ~10 Supabase containers internally. The devcontainer uses the **docker-in-docker** feature so those containers run inside your devcontainer.

> Hand-written `docker-compose.yml` (from Supabase's [self-hosting repo](https://github.com/supabase/supabase/tree/master/docker)) is only needed for **production self-hosting**. For local dev, the CLI gives you the same stack plus migrations, seeding, type generation, and Studio — with far less config.

---

## Quick start

```bash
# 1. Open in VS Code → "Reopen in Container"
#    (post-create installs npm deps + Supabase CLI;
#     post-start boots the Supabase Docker stack automatically)

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
| Inbucket (mail) | http://localhost:54324 |

`.env.local` is auto-created with local defaults (URL + the well-known local demo anon key). Nothing to change for local dev.

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

> **Tip:** You can register both the local (`http://localhost:54321/...`) and production (`https://<project>.supabase.co/...`) redirect URIs in the _same_ Google/Facebook app — no need for separate apps.

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
npx supabase migration new <name>   # new migration with a real timestamp
```

## Migrations

SQL files in `supabase/migrations/` run automatically on `supabase start` / `db reset`. A starter migration is included:

- `public.profiles` table linked to `auth.users`
- RLS policies (users read/update only their own row)
- Trigger that auto-creates a profile on signup (incl. OAuth — pulls `full_name` and `avatar_url` from Google/Facebook metadata)

And the job queue (`*_job_queue.sql`): `public.jobs` + pgmq with
`enqueue_job` / `worker_claim_jobs` / `worker_finish_job` (retry with
backoff, dead letter, poison sweep) and `queue_health` for monitoring.

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
  post-create.sh             # npm install, project_id from folder name, .env.local
  post-start.sh              # auto-starts the Supabase stack
.claude/                     # skills, security-review gate hook
AGENTS.md / CLAUDE.md        # agent instructions (CLAUDE.md imports AGENTS.md)
.mcp.json                    # next-devtools, supabase (local), shadcn
supabase/
  config.toml                # Local stack config incl. Google/Facebook OAuth
  migrations/                # SQL migrations (auto-applied)
app/
  (auth)/login/page.tsx      # /login page (Google + Facebook OAuth)
  (auth)/signup/page.tsx     # /signup page (same providers, own copy)
  auth/callback/route.ts     # OAuth code exchange
  auth/logout/route.ts
  app/dashboard/page.tsx     # Protected page (everything under /app requires login)
  api/health/{live,ready}    # health endpoints
  robots.ts, sitemap.ts      # SEO (runtime env)
  globals.css                # Tailwind v4 CSS-first config + Shadcn theme
proxy.ts                     # Request id, noindex, session refresh + route guard
instrumentation.ts           # onRequestError → structured log
utils/supabase/              # browser/server/service clients
components/ui/               # Shadcn components
lib/                         # Framework-free logic + Vitest unit tests (logger, queue, nav, site)
scripts/worker.mjs           # Background worker entry (bundled by scripts/build-worker-bundle.mjs)
scripts/worker/              # loop, queue consumer, monitor, plan (job handlers)
test/                        # Cross-cutting tests (client bundle guard, migrations)
docs/deployment.md           # Proxy caching, CWV, logging & monitoring best practices
.env.example                 # OAuth secrets for local Supabase stack
.env.local.example           # Next.js env (local defaults prefilled)
```

## Switching to hosted Supabase (production)

1. `npx supabase link --project-ref <your-project-ref>`
2. `npx supabase db push` — applies your migrations to the hosted DB
3. Set the production values in your deployment env (see comments in `.env.local.example`)
4. Configure Google/Facebook in the Supabase Dashboard with the hosted callback URL
