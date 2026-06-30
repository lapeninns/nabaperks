import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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

export default nextConfig
