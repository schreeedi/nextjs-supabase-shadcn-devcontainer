# Audit checklist: Next.js 16 + Supabase + shadcn/ui

A reusable checklist for projects on this stack. It comes from the October 2026
audit of this template. Every item below was a real finding here, or a check
that turned out fine and is cheap to repeat. Each item gives how to check it,
why it matters, and the source.

Work top to bottom. The sections are ordered by impact. Checks that need the
local stack are marked **(stack)**.

---

## 1. Supabase Auth configuration

- [ ] **Disable unused auth providers, email/password in particular.**
  - Check: `supabase/config.toml` → `[auth.email] enable_signup`. Live:
    `curl -H "apikey: <publishable>" http://127.0.0.1:54321/auth/v1/settings`
    → `external.email`, `mailer_autoconfirm`.
  - Try it: `POST /auth/v1/signup` with an email and password must return
    4xx if the app has no password login.
  - Why: email signup with auto-confirm on, plus OAuth, allows **pre-account
    takeover**. An attacker registers `victim@gmail.com`, and on the victim's
    first Google login Supabase links the identity to the attacker's account.
  - Hosted: Dashboard → Authentication → Providers → Email. config.toml does
    not deploy itself.
  - Source: https://supabase.com/docs/guides/auth/auth-identity-linking
- [ ] If email login is used, also set `enable_confirmations = true`, a
      minimum password length and `secure_password_change`.
- [ ] Only expose schemas you use. `[api] schemas` should not contain
      `graphql_public` if pg_graphql isn't installed.
- [ ] `site_url` and `additional_redirect_urls` list exactly the app's
      callback URLs, with no wildcards in production.

## 2. Database privileges and RLS **(stack)**

- [ ] **RLS is on for every table in exposed schemas.** Run the Supabase MCP
      `get_advisors` (security), or query `pg_tables` / `relrowsecurity`.
- [ ] **Grants are a separate lock from RLS.** For each table, check what
      `anon` and `authenticated` may do:
  ```sql
  select grantee, privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and table_name = '<t>'
    and grantee in ('anon', 'authenticated');
  select grantee, column_name, privilege_type from information_schema.column_privileges
  where table_schema = 'public' and table_name = '<t>'
    and grantee in ('anon', 'authenticated');
  ```
  - Why: Supabase grants INSERT, UPDATE, DELETE and TRUNCATE to the API roles
    by default. If a migration only does `revoke update`, a protected column
    like `plan`, `role` or `is_admin` stays writable via INSERT. The only thing
    stopping it is a missing policy, until someone adds "users can insert own
    row".
  - Fix: `revoke insert, delete, truncate, references, trigger on … from anon,
authenticated;` plus column-level `grant update (col, …)`.
- [ ] Billing-relevant columns (plan, credits, invoice status, amounts) are
      writable only by the service role.
- [ ] Policies use `to authenticated` and `(select auth.uid())`, not
      `auth.uid()` per row. UPDATE policies have both `using` and `with check`.
- [ ] **SECURITY DEFINER functions:**
  - Each has `set search_path = ''`.
  - Each has `revoke execute … from public, anon, authenticated` unless it is
    meant as an RPC.
  - In `public`, prefer `security invoker` wherever RLS gives the same answer
    (linter 0029).
  - Check: `select proname, prosecdef, proconfig from pg_proc where
pronamespace = 'public'::regnamespace;`
- [ ] Mirrored auth data (email in `profiles`) is kept in sync by a trigger
      on `auth.users` update, not only on insert.
- [ ] Foreign keys have indexes. Check the `get_advisors` (performance)
      `unindexed_foreign_keys` lint.
- [ ] **pgTAP tests exist** (`supabase/tests/database/*.test.sql`, run with
      `supabase test db`). They cover:
  - grants, via `has_table_privilege` and `has_column_privilege`
  - function privileges, via `has_function_privilege`
  - RLS with two users, switching `set local role authenticated` and
    `request.jwt.claims`; B must not read or change A's rows
  - triggers
  - Copy from: `supabase/tests/database/` in this template.

## 3. Supabase clients (`@supabase/ssr`)

- [ ] **The proxy/middleware applies the `headers` argument of `setAll`**
      (`@supabase/ssr` ≥ 0.10). It must reach the pass-through response _and_
      every redirect.
  - Why: those headers are `Cache-Control: no-store`, `Expires` and `Pragma`.
    Without them, a CDN or reverse proxy can serve one user's fresh session
    cookie to another.
  - Check: `grep -n "setAll(" utils/supabase/*.ts`. A signature with only
    `(cookiesToSet)` is the bug.
  - Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- [ ] Cookies use `getAll` / `setAll` only (no `get`/`set`/`remove`).
      Refreshed cookies are copied onto redirect responses.
- [ ] Server code uses `getClaims()` in the proxy and `getUser()` in
      pages/actions, never `getSession()` on the server.
- [ ] The service-role client file imports `server-only` and the key is
      never `NEXT_PUBLIC_*`. Check: `grep -rn "SERVICE_ROLE" app components`.
- [ ] **`types/database.ts` is generated and committed**, and every client
      is typed: `createServerClient<Database>`, `createBrowserClient<Database>`,
      `createClient<Database>`, `SupabaseClient<Database>` in helpers.
  - Check: `grep -rn " as " lib app | grep -i "data"`. Casts on query results
    mean the types are missing or stale.
  - `supabase gen types typescript --local` diffed against the committed file
    must be empty.
- [ ] The OAuth flow uses PKCE: `exchangeCodeForSession(code)` in the
      callback, and `next`/redirect targets are validated as same-origin paths.
- [ ] Logout is POST only.

## 4. Next.js 16 runtime configuration

- [ ] **No `process.env.NEXT_PUBLIC_*` for values that differ per
      environment at runtime.** Next inlines them at **build** time.
  - Check: `grep -rn "process.env.NEXT_PUBLIC_" app lib utils`, and for each
    hit ask: is the build-time value correct in every deployment?
  - Classic bug: the OAuth `redirectTo` is built from
    `NEXT_PUBLIC_SITE_URL`, but the deployment only sets `SITE_URL`. The
    result is `new URL(path, undefined)` and every login fails with a 500.
  - Source: `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- [ ] Middleware lives in `proxy.ts` (Next 16), exports `proxy`, and has no
      `runtime` export. The matcher excludes `_next/` (HMR) and `api/`.
- [ ] The proxy is an optimistic check only. Every protected page/action
      re-verifies the user.
- [ ] `cookies()`, `headers()`, `params` and `searchParams` are all awaited.
- [ ] A client-supplied correlation id (`x-request-id`) is validated before
      being logged (format and length).
- [ ] Rolling deploys or several instances: set `NEXT_DEPLOYMENT_ID` at build
      time. If instances are built separately, also set
      `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
  - Source: `…/02-guides/self-hosting.md`

## 5. Next.js routing, errors and metadata

- [ ] `app/not-found.tsx`, `app/error.tsx` (client component, `retry()`) and
      `app/global-error.tsx` (own `<html>/<body>` and imported global CSS) exist.
  - Source: `…/02-guides/production-checklist.md`
- [ ] Dynamic signed-in routes have `loading.tsx` skeletons with final
      sizes (CLS).
- [ ] `next build` route table: public marketing pages are `○` (static).
      `cookies()` or `getUser()` in their render path makes them `ƒ`.
- [ ] **Root-layout metadata contains nothing every page would wrongly
      inherit:**
  - no `alternates.canonical`
  - no `openGraph.url`
  - no openGraph title or description
  - no explicit `robots: { index: true }`, which ends up next to Next's own
    404 `noindex`
  - Check: `curl` a subpage and the 404 and grep `og:url`, `canonical`,
    `robots`, `<title>`.
  - Source: `…/04-functions/generate-metadata.md` (inheritance)
- [ ] Every public page sets `title`, `description` and
      `alternates.canonical`. Error and auth pages are `noindex`.
- [ ] An icon exists (`app/icon.*` or `favicon.ico`). If
      `twitter.card = "summary_large_image"`, there is an OG image
      (`app/opengraph-image.*`).
- [ ] No dead config: `images.remotePatterns` only if `next/image` is used,
      and then with the real hosts (every OAuth provider's avatar CDN).
- [ ] Server-rendered dates on static pages (e.g. `new Date().getFullYear()`
      in the footer) freeze at build time. Render them on the client or hardcode
      them.

## 6. Security headers

- [ ] CSP is set in `next.config.ts` `headers()`, with these directives:
  - `object-src 'none'`
  - `base-uri 'self'`
  - `frame-ancestors 'none'`
  - `form-action` lists the OAuth chain (Supabase and the provider hosts)
  - `connect-src` lists Supabase
  - `'unsafe-eval'` in dev only
  - **`upgrade-insecure-requests` in production only** (in dev it breaks
    `http://127.0.0.1:54321`)
  - Source: `…/02-guides/content-security-policy.md`
- [ ] Also set: `X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy`. HSTS is set at the reverse proxy.
- [ ] New third-party origins (payment provider, PDF service, analytics) are
      added to the CSP.

## 7. shadcn/ui and Tailwind v4

- [ ] `components.json`:
  - `style` is not `"default"` (deprecated, with no v4 registry, so `shadcn
add` keeps serving v3 components)
  - `tailwind.config` is `""`
  - `baseColor` is a current option
- [ ] Components in `components/ui/` are the v4 versions: function
      components with `data-slot`, imports from `radix-ui`, no `forwardRef`.
  - Check: `grep -ln "forwardRef\|@radix-ui/react-" components/ui/*.tsx`
  - Fix: `npx shadcn@latest add <names> --overwrite`, then re-apply local
    tweaks. Better: move tweaks into `globals.css` so overwrites keep them.
- [ ] **After every `shadcn add`**, check the diff for new npm packages. The
      current registry imports `cn` from the npm package `cn`. Decide
      deliberately: keep `@/lib/utils`, or adopt the package. Don't let it slip
      in.
- [ ] No unused `@radix-ui/*` dependencies. `toast` is deprecated; use
      `sonner`.
- [ ] `globals.css`:
  - OKLCH tokens with `--color-x: var(--x)` (not `hsl(var(--x))`)
  - chart and sidebar tokens
  - full radius scale
  - no leftover accordion keyframes when `tw-animate-css` is imported
- [ ] Dark mode is either wired up (`next-themes`, `attribute="class"`,
      `suppressHydrationWarning` on `<html>`) or the `.dark` block is removed.
      Never leave dead CSS.
- [ ] `postcss.config.mjs` contains only `@tailwindcss/postcss`.
      `prettier-plugin-tailwindcss` has `tailwindStylesheet` set.

## 8. Accessibility (quick pass)

- [ ] **Exactly one `<h1>` per page**, with no skipped heading levels.
  - In v4, `CardTitle` is a `<div>`, so put a real heading inside it.
  - Check: `curl -s <page> | grep -oE "<h[1-6][^>]*>"`.
- [ ] No `href="#"` placeholder links. Remove them until the page exists.
      For an invoice app this applies especially to the legal pages (imprint,
      privacy, terms).
- [ ] Decorative emoji and icons are `aria-hidden`. Icon-only buttons have
      `sr-only` text.
- [ ] Form controls have a `<label htmlFor>`. Results are announced with
      `role="status"` or `role="alert"`.
- [ ] Links are visually recognisable as links.

## 9. Process

- [ ] `npm run check` is green: format, lint, typecheck, strict typecheck,
      unit tests.
- [ ] `supabase test db` is green **(stack)**.
- [ ] `next build && next start` is checked by hand:
  - route table
  - `curl` the headers (CSP, `x-request-id`, `Cache-Control` on responses
    that refresh the session)
  - one look at every changed page in light and dark mode
- [ ] New migrations and env vars are named in the commit/PR. Hosted
      settings (auth providers) are written down as manual steps.

---

## Specific to saas-invoice (on top of the above)

These come from the domain, not from this template's audit. Check them with
the same rigour:

- [ ] Invoice numbers are unique and gapless per issuer, assigned in the
      database (sequence or locked counter row in one transaction), never
      computed in the app.
- [ ] Issued invoices are immutable. Corrections go through credit notes. Use
      a trigger or RLS so that `update`/`delete` on an issued invoice fails even
      for buggy server code.
- [ ] Amounts are stored as integer minor units or `numeric`, never `float`.
      Rounding happens in one place (`lib/`) with tests.
- [ ] The tax rate and invoice date are stored on the invoice (snapshot),
      not looked up from current settings when rendering.
- [ ] Every invoice/customer table has RLS by tenant or owner, with a pgTAP
      test where user B cannot read A's invoices or PDFs.
- [ ] PDF generation and sending emails are queue jobs (idempotent), not work
      inside the request.
- [ ] Storage buckets for PDFs are private, accessed only via signed URLs,
      with Storage RLS policies per owner.
- [ ] Retention: invoices must be kept for years (e.g. 8–10 in DE). Account
      deletion must not cascade-delete issued invoices. Check the
      `on delete cascade` on `user_id`.
