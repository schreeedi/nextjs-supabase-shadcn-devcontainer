# Deployment, caching & operations — best practices

The template ships no deploy setup. This page collects what proved itself in
production on self-hosted Next.js + Supabase (Docker behind nginx), so the
first deployment doesn't rediscover it. Supabase auth settings for production
(signup providers, OAuth): README → "Production: self-hosted Supabase".

## Processes

| Process | Start                                                                       | Health                                                  |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| App     | `next build` → `next start` (or `output: "standalone"`)                     | `/api/health/live` (liveness), `/api/health/ready` (DB) |
| Worker  | `npm run build:worker` → `node --enable-source-maps dist/worker/worker.mjs` | log lines (`worker started`, `queue health`)            |

- Run the worker as its **own container/process**, never inside the app
  process. It needs no Next and no public port; scale it independently.
- Same `TZ` everywhere (container env, CI, Vitest) — "today" is computed in
  process time.
- `SITE_ENV=staging` (anything but empty/`prod`/`production`) → `noindex` via
  `robots.txt` and `X-Robots-Tag`. `SITE_URL` must be set at **build** time
  too: static pages bake `metadataBase`/canonical URLs in. The OAuth callback
  reads it at runtime (`authCallbackUrl()`); never use
  `process.env.NEXT_PUBLIC_*` for runtime config — Next inlines it at build.
- Liveness must not check dependencies: a DB outage would otherwise restart
  healthy app containers in a loop. Readiness may.

### Rolling deploys / several instances

- `NEXT_DEPLOYMENT_ID=<git sha>` at **build** time: Next tags assets
  (`?dpl=`) and navigations with it and forces a full reload when a browser
  still runs the old version — no "Failed to find Server Action" or missing
  chunks mid-deploy. Complements the nginx cache below, which keeps old
  `/_next/static` chunks around.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`): only if
  instances are **built separately**. One image built once and scaled out
  already shares the key it was built with.

## Reverse proxy (nginx) — caching and limits

Decision and rejected alternatives: [ADR-003](adr/003-proxy-caches-only-static-assets.md).

What to cache: **only `/_next/static/*`.** Those files are content-hashed and
Next already sends `Cache-Control: public, max-age=31536000, immutable`. A
proxy cache additionally keeps serving the _old_ chunks to tabs that are
still open after a deploy (otherwise they 404 on the next navigation).

What **not** to cache: HTML, RSC payloads (`?_rsc=`, `RSC: 1` header), Server
Actions (POST with `Next-Action`), `/api/*`, `/auth/*`. They depend on cookies.
No microcaching of HTML in front of authenticated apps — one cached response
with a `Set-Cookie` leaks a session.

```nginx
# http context
proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zone=static:10m
                 max_size=512m inactive=30d use_temp_path=off;
map $uri $cache_skip { ~^/_next/static/ 0; default 1; }

# server / location context
proxy_cache static;
proxy_no_cache $cache_skip;
proxy_cache_bypass $cache_skip;
proxy_cache_lock on;
proxy_cache_use_stale error timeout updating http_502 http_503 http_504;
add_header X-Cache-Status $upstream_cache_status always;
```

Supabase-specific — **required**, or the OAuth callback fails with
`502 upstream sent too big header` (session cookies are split into ~3.2 KB
chunks):

```nginx
proxy_buffer_size 16k;
proxy_buffers 8 16k;
proxy_busy_buffers_size 32k;
```

Further settings:

- `client_max_body_size` slightly **above** Next's
  `experimental.serverActions.bodySizeLimit` (default 1 MB) and
  `experimental.proxyClientMaxBodySize` (default 10 MB) — the app should
  produce the error, not a bare nginx 413.
- Streaming (RSC, SSE): `proxy_buffering off;` for the app, and let Next opt
  static chunks back into buffering with `X-Accel-Buffering: yes`
  (`headers()` in `next.config.ts`) so they can be cached.
- Rate limit per IP, but **exempt `/_next/static/`** (a 429 on a chunk breaks
  the page). Size it from real page views (~50 requests per view):
  ```nginx
  map $uri $rl_static { ~^/_next/static/ 1; default 0; }
  map $rl_static $rl_key { 0 $binary_remote_addr; default ""; }
  limit_req_zone $rl_key zone=req_v1:10m rate=30r/s;
  limit_req zone=req_v1 burst=60 nodelay;
  limit_req_status 429;
  ```
  Version the zone name (`req_v1`, `req_v2` …): changing a zone's key under
  the same name makes `nginx -s reload` fail.
- Pass `X-Request-Id` (`proxy_set_header X-Request-Id $request_id;`) — the
  app reuses it as correlation id (`proxy.ts`), so proxy and app logs join up.
- HSTS, gzip/brotli for text responses, TLS via ACME at the proxy.
- `public/` files have no content hash: give them a moderate cache
  (`public, max-age=86400, stale-while-revalidate=604800`) via `headers()` in
  `next.config.ts`, never `immutable`.

## Core Web Vitals

- Marketing pages **static**: no `cookies()`/`getUser()` in their render path;
  login state for the header comes from the cookie on the client
  (`components/signed-in.tsx`). The build output must show `○` for them.
- Above-the-fold content rendered on the server, not behind `ssr: false`
  (measured: LCP 4.6 s → 2.9 s). Heavy client libraries (PDF, charts, QR)
  via `await import()` on interaction or `next/dynamic` below the fold.
- Suspense/`loading.tsx` fallbacks with the **final size** of the content —
  a short skeleton for a tall component caused CLS 0.71.
- `prefetch={false}` on links to auth-dynamic pages (`/app/*`): each prefetch
  runs the proxy's session check; dozens per view add up.
- Fonts via `next/font` (self-hosted, `display: "swap"`), images via
  `next/image` with explicit `width`/`height` (or pre-converted WebP when
  self-hosting without `sharp`).
- Measure against a production build: `npx lighthouse@12 <url>
--only-categories=performance` — never against `next dev`.

## Logging & monitoring

- Every process writes **JSON lines** to stdout/stderr (`lib/logger.ts`):
  `level`, `time`, `msg`, `service`, plus context (`requestId`, `userId`,
  `queue`, `job` …). Secret-looking keys are redacted.
- Uncaught server errors: `instrumentation.ts` → `onRequestError`. Plug
  Sentry/OpenTelemetry in there when needed.
- Queues: the worker's `monitor:queues` loop checks every minute and logs
  `queue unhealthy` (level `error`) on backlog, old messages or dead jobs,
  `queue recovered` once afterwards; steady health is `debug` only. Alert on
  `level=error` rate in your log stack (Loki/Grafana, Logflare, Datadog, …).
- No empty log data: the logger drops `undefined`/`null`/`""`/`[]`/`{}`
  fields and masks e-mail addresses in messages. Don't log "nothing
  happened" lines (empty polls, 0 jobs) above `debug`.
- Uptime: external monitor (Uptime Kuma, UptimeRobot) on `/api/health/live`,
  60 s interval, alert after 3 failures; a second one on `/api/health/ready`.
- Supabase advisors after schema changes (`supabase db advisors` / the
  Supabase MCP `get_advisors`) — missing RLS, unindexed foreign keys.
