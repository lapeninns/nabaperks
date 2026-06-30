import type { Metadata } from "next"
import type { ReactNode } from "react"
import { headers } from "next/headers"

import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"

/**
 * /dev layout — the safety net for every dev/QA harness page.
 *
 * - `metadata.robots` keeps the whole /dev tree out of search indexes (a
 *   layout-level guard complementing the per-page robots already set on
 *   design-system). The pages themselves stay `notFound()` in production.
 * - An optional `?w=<px>` query constrains an outer wrapper to an exact CSS
 *   pixel width so a headless screenshot pins the breakpoint regardless of the
 *   browser window size. When `w` is absent the layout is a thin passthrough,
 *   so design-system and poster-preview render exactly as before.
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const MIN_WIDTH = 240
const MAX_WIDTH = 3840

export default async function DevLayout({
  children,
}: {
  children: ReactNode
}) {
  const width = await readWidthOverride()

  if (width == null) {
    return children
  }

  return (
    <div
      data-dev-width={width}
      style={{ width: `${width}px`, maxWidth: "100%", marginInline: "auto" }}
    >
      {children}
    </div>
  )
}

/**
 * Read an optional `?w=<px>` from the request path header (proxy.ts sets it to
 * `${pathname}${search}` on every app route). Returns a clamped integer width,
 * or null when absent/invalid so the layout stays a passthrough.
 */
async function readWidthOverride(): Promise<number | null> {
  const requestHeaders = await headers()
  const requestPath = requestHeaders.get(REQUEST_PATH_HEADER)
  if (!requestPath) {
    return null
  }

  const queryIndex = requestPath.indexOf("?")
  if (queryIndex < 0) {
    return null
  }

  const raw = new URLSearchParams(requestPath.slice(queryIndex)).get("w")
  if (!raw) {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.min(Math.max(parsed, MIN_WIDTH), MAX_WIDTH)
}
