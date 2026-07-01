import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"
import {
  dynamicContentSecurityPolicy,
  isStaticMarketingPath,
  staticMarketingContentSecurityPolicy,
} from "@/lib/security/csp"

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), payment=(), usb=(), interest-cohort=(), geolocation=(self)",
} as const

// Next.js 16 Proxy (formerly middleware). Its single job here is observability:
// give every request a stable trace id. It reuses an inbound `x-request-id`
// (e.g. from a load balancer) or mints one, exposes it to server components and
// route handlers via the forwarded request headers, and echoes it on the
// response so clients and logs can be correlated end to end.
export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const nonce = isStaticMarketingPath(request.nextUrl.pathname)
    ? undefined
    : btoa(crypto.randomUUID())
  const csp =
    nonce === undefined
      ? staticMarketingContentSecurityPolicy()
      : dynamicContentSecurityPolicy(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(REQUEST_PATH_HEADER, requestPath)
  if (nonce !== undefined) {
    requestHeaders.set("x-nonce", nonce)
  }
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  response.headers.set("Content-Security-Policy", csp)
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value)
  }
  return response
}

export const config = {
  // Run on application routes; skip Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
}
