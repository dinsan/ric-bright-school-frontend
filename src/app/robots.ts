import type { MetadataRoute } from "next";
import { absoluteUrl, siteConfig } from "@/config/site";

/**
 * /robots.txt. Public pages are open to crawlers; the API, sign-in plumbing, one-time links and the
 * signed-in areas are not (they are also marked noindex). Builds that aren't the public site (previews,
 * staging, localhost: see next.config.ts) shut crawlers out entirely.
 */
export default function robots(): MetadataRoute.Robots {
  if (!siteConfig.indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/learn", "/teach", "/family", "/admin", "/account", "/verify-email", "/reset-password", "/confirm-email", "/design"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
