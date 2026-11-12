import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
