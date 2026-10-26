import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    // Staff-only areas are never indexed.
    rules: { userAgent: "*", allow: "/", disallow: ["/login", "/dashboard", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
