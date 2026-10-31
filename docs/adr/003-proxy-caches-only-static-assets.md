# ADR-003: Reverse proxy caches only `/_next/static`

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Self-hosted deployments put nginx (or a similar proxy) in front of Next.js.
Caching at the proxy is tempting for performance, but most responses of an
authenticated app depend on cookies: HTML, RSC payloads, Server Action
responses and API calls. A single cached response that carries a
`Set-Cookie` or another user's data leaks a session or personal data.
Separately, open browser tabs keep requesting the previous deploy's chunks,
which 404 once the new build replaced them.

## Decision

The proxy caches **only `/_next/static/*`** (content-hashed, already
`immutable` from Next) and serves stale entries on upstream errors, which
also keeps old chunks available to open tabs after a deploy. Everything else
bypasses the cache. Public marketing pages get their speed from being
**statically rendered** (no session lookup in their render path), not from
proxy microcaching. Details and nginx snippets: `docs/deployment.md`.

## Alternatives considered

- **Microcaching HTML (1–10 s)** — big win for anonymous traffic, but one
  misconfigured `Cache-Control`/cookie interaction serves user A's page to
  user B. Too risky as a default.
- **CDN in front** — valid later for global latency; same rule applies
  (static assets yes, personalised responses no).
- **No proxy cache at all** — works, but loses the "old chunks after deploy"
  safety net and adds upstream load for every asset request.

## Consequences

- No personalised response can ever be served from the proxy cache.
- Landing/marketing pages must stay static (`○` in `next build`); signed-in
  hints come from the client (`components/signed-in.tsx`).
- Revisit with a CDN or when anonymous traffic is large enough that
  per-request rendering of public pages becomes a cost problem — then cache
  explicitly marked public routes only.
