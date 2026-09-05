import type { NextConfig } from "next"
import withBundleAnalyzer from "@next/bundle-analyzer"

import {
  COMMON_SECURITY_HEADERS,
  staticMarketingContentSecurityPolicy,
} from "./lib/security/csp"

const playwrightDistDir = process.env.PLAYWRIGHT_NEXT_DIST_DIR?.trim()
const isPlaywrightHarness = process.env.PLAYWRIGHT_HARNESS === "1"

const nextConfig: NextConfig = {
  ...(playwrightDistDir ? { distDir: playwrightDistDir } : {}),
  ...(isPlaywrightHarness
    ? {
        // Browser shards visit many unrelated routes in one dev-server
        // process. Dispose inactive entries aggressively so Webpack cannot
        // retain every compiled page until Next reaches its restart threshold.
        onDemandEntries: {
          maxInactiveAge: 5_000,
          pagesBufferLength: 1,
        },
      }
    : {}),
  // Drop the `x-powered-by: Next.js` response header — a free stack info-leak
  // hardening (flagged in the 2026-07-05 GEO/technical audit).
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/*": ["./assets/fonts/*.ttf"],
  },
  // The automatic barrel optimiser leaves the full Hugeicons catalogue in
  // webpack development chunks. Use its public per-icon exports explicitly
  // so the shared layout only contains the icons that it renders.
  modularizeImports: {
    "@hugeicons/core-free-icons": {
      transform: "@hugeicons/core-free-icons/{{member}}",
      preventFullImport: true,
    },
  },
  experimental: {
    optimizePackageImports: ["@hugeicons/react", "radix-ui", "motion"],
  },
  // Allow the loopback IP origin in dev so agent browser proofs driven against
  // http://127.0.0.1 can load `/_next` dev chunks (e.g. the dynamic Leaflet
  // pin map). Dev-only; has no effect on production builds.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...COMMON_SECURITY_HEADERS,
          {
            key: "Content-Security-Policy",
            value: staticMarketingContentSecurityPolicy(),
          },
        ],
      },
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
        source: "/:path*",
        has: [{ type: "host", value: "www.nabaperks.com" }],
        destination: "https://nabaperks.com/:path*",
        permanent: true,
      },
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

const analyzedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig)

export default analyzedConfig
