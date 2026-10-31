import type { MetadataRoute } from "next";
import { siteIndexable, siteUrl } from "@/lib/site";

// Runtime, not build time: the site URL and environment come from the
// deployment's env (one build for staging and prod).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app/", "/admin/", "/api/", "/auth/", "/error"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
