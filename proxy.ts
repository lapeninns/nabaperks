import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"

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
  const nonce = btoa(crypto.randomUUID())
  const csp = contentSecurityPolicy(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(REQUEST_PATH_HEADER, requestPath)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  response.headers.set("Content-Security-Policy", csp)
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value)
  }
  return response
}

function contentSecurityPolicy(nonce: string) {
  const scriptDevEscape =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  const upgradeInsecure =
    process.env.NODE_ENV === "development" ? "" : "; upgrade-insecure-requests"

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${scriptDevEscape}`,
    `script-src-elem 'self' 'nonce-${nonce}' https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors 'none'${upgradeInsecure}`,
  ].join("; ")
}

export const config = {
  // Run on application routes; skip Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
}
