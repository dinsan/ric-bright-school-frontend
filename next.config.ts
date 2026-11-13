import type { NextConfig } from "next";

/**
 * The site's public address, for canonical URLs, the sitemap, robots.txt and share images. These end up
 * in prerendered HTML, so the address is fixed when the app is built: SITE_URL (falls back to APP_URL,
 * then localhost). Inlined below so server and browser code read the same value.
 */
function siteUrl(): string {
  const raw = process.env.SITE_URL || process.env.APP_URL || "http://localhost:3000";
  try {
    const url = new URL(raw);
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    throw new Error(`SITE_URL must be an absolute URL such as https://lumina.example (got "${raw}")`);
  }
}

const SITE_URL = siteUrl();
// Never let search engines index a build that points at localhost, or one marked as not for indexing
// (previews, staging): SITE_NOINDEX=true.
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/.test(SITE_URL);
const SITE_NOINDEX = process.env.SITE_NOINDEX === "true" || isLocal ? "true" : "false";

if (process.env.NODE_ENV === "production" && process.argv.includes("build") && isLocal) {
  console.warn(`⚠ SITE_URL is ${SITE_URL}: canonical URLs and the sitemap point there, and pages are marked noindex. Set SITE_URL to the public address for a live build.`);
}

// Development in Docker: if file-change events don't reach the container (some Windows and macOS
// setups), WATCH_POLL_INTERVAL_MS=1000 makes the dev server poll instead. Off by default: polling costs CPU.
const pollIntervalMs = Number(process.env.WATCH_POLL_INTERVAL_MS) || 0;

const nextConfig: NextConfig = {
  output: "standalone",
  ...(pollIntervalMs > 0 ? { watchOptions: { pollIntervalMs } } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Import only the Radix primitives that are used from the `radix-ui` barrel package.
    optimizePackageImports: ["radix-ui"],
  },
  env: {
    // Inlined at build time so every page shows the same year: static pages are prerendered
    // at build, dynamic ones per request, and `new Date()` in render would disagree across them.
    BUILD_YEAR: String(new Date().getFullYear()),
    SITE_URL,
    SITE_NOINDEX,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
