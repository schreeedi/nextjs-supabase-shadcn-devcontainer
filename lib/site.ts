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
