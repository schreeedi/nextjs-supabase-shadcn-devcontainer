# ADR-004: E2E sessions via service-role magic links, Playwright + agent-browser

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

User journeys (dashboard, sign-out, admin plan change) need a signed-in
browser. Sign-in is OAuth only (Google, Facebook): a test can't click through
a third-party login, and email/password signup is off on purpose (pre-account
takeover, see `supabase/config.toml`). Agents also need to _look_ at pages
(AGENTS.md: render UI work), not only assert on HTML.

## Decision

- **Playwright** (`@playwright/test`, `e2e/`, `npm run test:e2e`) runs against
  a production build on port 3100 with `ADMIN_USER_IDS` set to a fixed E2E
  admin id (`playwright.config.ts`).
- **Sessions:** the setup project creates fixed-id test users with the
  service role, issues a magic link (`auth.admin.generateLink`) and redeems
  it with the same `@supabase/ssr` client the app uses, so the cookies are
  exactly the app's (`e2e/users.ts`). Teardown deletes the users.
- One user per mutating journey (plan change, sign-out — `signOut()` revokes
  all of a user's sessions); tests arrange their own state.
- **agent-browser** for agent screenshots/interaction (`npm run browser --`),
  pointed at Playwright's Chromium — one browser, installed by
  `.devcontainer/post-create.sh` (`playwright install --with-deps chromium`).

## Alternatives considered

- **Email/password test users** — needs the email provider on, which reopens
  the takeover hole or makes test and prod config differ.
- **Self-signed JWT in a cookie** — breaks with asymmetric signing keys and
  skips session rows GoTrue checks; brittle across Supabase versions.
- **A test-only `/auth/confirm` route in the app** — production surface for a
  test concern.
- **Mocking OAuth** — tests a fake, not the app's real session handling.

## Consequences

- E2E needs the local Supabase stack and the service-role key (`.env.local`,
  falls back to the local defaults in `.env.local.example`).
- Magic-link redemption works with the email provider off only because the
  service role issues the token; if Supabase ever gates that on the provider,
  revisit (e.g. a dedicated test project with email login on).
- OAuth itself (provider round trip, callback code exchange) stays untested
  end-to-end; the callback is covered by unit tests of its helpers.
