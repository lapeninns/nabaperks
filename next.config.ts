import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    // Phase 2 URL merge: the card/staff/QR setup pages now live as tabs inside
    // the Launch hub. Exact-path 301s preserve bookmarks and search equity.
    // NOTE: `source: "/app/qr"` is exact — it must NOT match the QR asset
    // routes (/app/qr/image|preview|download/*), which stay live.
    return [
      {
        source: "/app/card",
        destination: "/app/launch?tab=card",
        permanent: true,
      },
      {
        source: "/app/staff",
        destination: "/app/launch?tab=staff",
        permanent: true,
      },
      {
        source: "/app/qr",
        destination: "/app/launch?tab=qr",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
