import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"

// Next.js 16 Proxy (formerly middleware). Its single job here is observability:
// give every request a stable trace id. It reuses an inbound `x-request-id`
// (e.g. from a load balancer) or mints one, exposes it to server components and
// route handlers via the forwarded request headers, and echoes it on the
// response so clients and logs can be correlated end to end.
export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(REQUEST_PATH_HEADER, requestPath)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

export const config = {
  // Run on application routes; skip Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
}
