import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Public, indexable pages only (no /app, no login/signup — those are noindex).
// Set lastModified only where a real edit date exists: "now" on every request
// is a worthless signal for crawlers.
const PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.map(({ path, priority }) => ({
    url: `${base}${path}`,
    priority,
  }));
}
