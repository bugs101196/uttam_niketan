import type { MetadataRoute } from "next";
import { navLinks } from "@/components/layout/nav-links";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return navLinks.map((link) => ({ url: new URL(link.href, siteUrl).toString() }));
}
