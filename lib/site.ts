// Site identity and environment — read at runtime, so one build can serve
// several environments (staging, prod). Framework-free.

export const SITE_NAME = "My App";
export const SITE_DESCRIPTION = "Next.js app with Supabase authentication";

/** Public origin without trailing slash (canonical URLs, sitemap, OG). */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    env.SITE_URL || env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * OAuth redirect target. Uses siteUrl(), never `process.env.NEXT_PUBLIC_*`
 * directly: Next inlines those at build time, and deployments set SITE_URL.
 * `next` must already be validated (safeNextPath); the callback checks again.
 */
export function authCallbackUrl(
  next: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = new URL("/auth/callback", siteUrl(env));
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

/**
 * May search engines index this deployment? Only an explicit non-prod
 * `SITE_ENV` (staging, preview, …) turns indexing off — a missing variable
 * must never de-index production.
 */
export function siteIndexable(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = (env.SITE_ENV ?? "").trim().toLowerCase();
  return value === "" || value === "prod" || value === "production";
}

/** Value for X-Robots-Tag on non-indexable deployments. */
export const NOINDEX_HEADER = "noindex, nofollow";
