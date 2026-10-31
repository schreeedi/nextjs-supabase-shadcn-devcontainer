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

## Auth

- MFA (aal2) for `/admin` once the app has 2FA (see AGENTS.md).
