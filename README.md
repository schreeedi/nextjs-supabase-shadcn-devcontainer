# Next.js + Supabase (local Docker) + Shadcn UI — Devcontainer

A ready-to-run Next.js 16 app with a **fully local Supabase stack running in Docker**:

- **Supabase local stack** (Postgres, Auth, PostgREST, Storage, Studio) via Supabase CLI
- **Google OAuth** + **Microsoft (Azure) OAuth** login
- **Shadcn UI** + Tailwind CSS v4
- **Vitest** unit tests + ESLint (flat config) + Prettier, wired up in CI
- Devcontainer with **docker-in-docker**

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
cp .env.example .env          # fill in Google/Azure client IDs + secrets

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

### Microsoft (Azure)

1. [Azure Portal](https://portal.azure.com) → App registrations → New registration.
2. Redirect URI (Web): `http://localhost:54321/auth/v1/callback`
3. Certificates & secrets → New client secret.
4. Put values in `.env`:
   ```env
   SUPABASE_AUTH_AZURE_CLIENT_ID=...
   SUPABASE_AUTH_AZURE_SECRET=...
   ```

Both providers are already enabled in `supabase/config.toml`. Restart the stack after editing `.env`:

```bash
supabase stop && supabase start
```

> **Tip:** You can register both the local (`http://localhost:54321/...`) and production (`https://<project>.supabase.co/...`) redirect URIs in the _same_ Google/Azure app — no need for separate apps.

---

## Useful commands

```bash
npm test              # run Vitest unit tests (npm run test:watch for watch mode)
npm run lint          # ESLint
npm run format        # Prettier (incl. Tailwind class sorting)
npm run db:start      # supabase start  — boot the Docker stack
npm run db:stop       # supabase stop   — stop containers (data persists)
npm run db:reset      # wipe DB + re-run migrations + seed
npm run db:status     # show URLs + keys
supabase db diff      # generate migration from Studio changes
supabase gen types typescript --local > lib/database.types.ts
```

## Migrations

SQL files in `supabase/migrations/` run automatically on `supabase start` / `db reset`. A starter migration is included:

- `public.profiles` table linked to `auth.users`
- RLS policies (users read/update only their own row)
- Trigger that auto-creates a profile on signup (incl. OAuth — pulls `full_name` and `avatar_url` from Google/Microsoft metadata)

---

## Project structure

```
.devcontainer/
  devcontainer.json          # Node 24 + docker-in-docker + port forwards
  post-create.sh             # npm install + Supabase CLI install
  post-start.sh              # auto-starts the Supabase stack
supabase/
  config.toml                # Local stack config incl. Google/Azure OAuth
  migrations/                # SQL migrations (auto-applied)
app/
  auth/login/page.tsx        # Google + Microsoft login buttons
  auth/callback/route.ts     # OAuth code exchange
  auth/logout/route.ts
  dashboard/page.tsx         # Protected page
  globals.css                # Tailwind v4 CSS-first config + Shadcn theme
proxy.ts                     # Session refresh + route guard (Next 16 middleware)
utils/supabase/              # SSR-safe browser/server clients
components/ui/               # Shadcn components
lib/                         # Utilities + Vitest unit tests
.env.example                 # OAuth secrets for local Supabase stack
.env.local.example           # Next.js env (local defaults prefilled)
```

## Switching to hosted Supabase (production)

1. `supabase link --project-ref <your-project-ref>`
2. `supabase db push` — applies your migrations to the hosted DB
3. Set the production values in your deployment env (see comments in `.env.local.example`)
4. Configure Google/Azure in the Supabase Dashboard with the hosted callback URL
