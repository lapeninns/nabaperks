import type { NextConfig } from "next"
import withBundleAnalyzer from "@next/bundle-analyzer"

const nextConfig: NextConfig = {
  // Drop the `x-powered-by: Next.js` response header — a free stack info-leak
  // hardening (flagged in the 2026-07-05 GEO/technical audit).
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Convert barrel imports of these packages into direct deep imports at
    // build time. The @hugeicons ESM barrel alone is ~604 KB / ~11k files and
    // we use ~68 icons, so this stops the compiler walking the whole set on
    // icon-heavy client routes. Named imports already tree-shake in prod; this
    // is the build-time safety net + a dev/prod compile-speed win.
    optimizePackageImports: [
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
      "radix-ui",
      "motion",
    ],
  },
  // Allow the loopback IP origin in dev so agent browser proofs driven against
  // http://127.0.0.1 can load `/_next` dev chunks (e.g. the dynamic Leaflet
  // pin map). Dev-only; has no effect on production builds.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: "/app/card",
        destination: "/app/launch?tab=card",
        permanent: true,
      },
      {
        source: "/wallet",
        destination: "/home",
        permanent: true,
      },
      {
        source: "/wallet/:path*",
        destination: "/home/:path*",
        permanent: true,
      },
    ]
  },
}

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig)
