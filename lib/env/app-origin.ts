import "server-only"

import { resolveCanonicalAppOrigin } from "@/lib/env/app-origin-core"

export function getCanonicalAppOrigin(): string {
  return resolveCanonicalAppOrigin({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  })
}
