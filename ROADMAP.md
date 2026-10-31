# Roadmap

Open work that isn't in code yet. Done items are removed, not ticked.

## Legal pages

- Terms, privacy policy and imprint (Impressum — required for German
  sites). The placeholder `href="#"` links were removed; add the pages, link
  them from `components/site-footer.tsx` and the auth card, and add them to
  `app/sitemap.ts`.

## UI

- Replace the generated `app/icon.tsx` / `app/opengraph-image.tsx` with a
  real logo and share image.
- `shadcn add` now imports `cn` from the npm package `cn` (shadcn-ui/cn,
  first release under that name 2026-10-30). We keep `@/lib/utils`;
  reconsider once the package has a track record — then drop the rewrite step
  and `test/shadcn-components.test.ts`'s cn check.

## Testing

- Load tests with k6 against a staging deployment (not the devcontainer):
  the proxy's session refresh, `/api/health/ready`, a signed-in dashboard
  render, and enqueue throughput of the job queue. Gives numbers for nginx
  limits, the Supabase pooler size and `visibilitySeconds`. Needs a target
  that resembles production first — locally it would measure Docker on WSL.
- E2E in CI (GitHub Actions: supabase start, playwright install --with-deps).

## Auth

- MFA (aal2) for `/admin` once the app has 2FA (see AGENTS.md).
