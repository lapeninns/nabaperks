import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "@/lib/observability/request-id"
import {
  JOIN_JOURNEY_COOKIE,
  JOIN_JOURNEY_HEADER,
  JOIN_JOURNEY_TTL_SECONDS,
  isJoinJourneyPath,
} from "@/lib/customer/join-observability-contract"
import {
  issueFunnelToken,
  verifyFunnelToken,
} from "@/lib/analytics/funnel-token"
import { REQUEST_PATH_HEADER } from "@/lib/navigation/request-path"
import {
  COMMON_SECURITY_HEADERS,
  dynamicContentSecurityPolicy,
} from "@/lib/security/csp"
import { CUSTOMER_DEVICE_HEADER } from "@/lib/security/rate-limit-core"
import {
  issueCustomerDeviceToken,
  verifyCustomerDeviceToken,
} from "@/lib/security/customer-device-token"
import { refreshSupabaseSession } from "@/lib/supabase/update-session"

const CUSTOMER_DEVICE_COOKIE = "nabaperks_device"
const CUSTOMER_DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60
const FORWARDED_HOST_PATTERN = /^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d+)?$/i
const FORWARDED_PROTOCOL_PATTERN = /^(?:http|https)$/

// Next.js 16 Proxy (formerly middleware). Refreshes Supabase auth cookies on
// stateful application requests, then attaches observability and security
// headers. Cacheable brochure routes are deliberately outside the matcher and
// receive equivalent fixed headers from next.config.ts. It reuses an
// inbound `x-request-id` (e.g. from a load balancer) or mints one, exposes it to
// server components and route handlers via the forwarded request headers, and
// echoes it on the response so clients and logs can be correlated end to end.
export async function proxy(request: NextRequest) {
  const operationalProbe = isOperationalProbePath(request.nextUrl.pathname)
  const publicNonceRoute = request.nextUrl.pathname === "/"
  const bypassSessionRefresh = operationalProbe || publicNonceRoute
  const requestId = resolveRequestId(request.headers)
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const nonce = btoa(crypto.randomUUID())
  const csp = dynamicContentSecurityPolicy(nonce)
  const joinJourney = bypassSessionRefresh ? null : resolveJoinJourney(request)
  const customerDevice = bypassSessionRefresh
    ? null
    : resolveCustomerDevice(request)

  const createResponse = () => {
    const requestHeaders = forwardedRequestHeaders(
      request,
      requestId,
      requestPath,
      csp,
      nonce,
      joinJourney?.token,
      customerDevice?.isNew ? undefined : customerDevice?.id
    )
    const nextResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })
    nextResponse.headers.set(REQUEST_ID_HEADER, requestId)
    nextResponse.headers.set("Content-Security-Policy", csp)
    for (const { key, value } of COMMON_SECURITY_HEADERS) {
      nextResponse.headers.set(key, value)
    }
    return nextResponse
  }

  const response = bypassSessionRefresh
    ? createResponse()
    : await refreshSupabaseSession(request, createResponse)

  if (joinJourney?.isNew) {
    response.cookies.set(JOIN_JOURNEY_COOKIE, joinJourney.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: JOIN_JOURNEY_TTL_SECONDS,
    })
  }

  if (customerDevice?.isNew) {
    response.cookies.set(CUSTOMER_DEVICE_COOKIE, customerDevice.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CUSTOMER_DEVICE_TTL_SECONDS,
    })
  }

  if (isAdminPath(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
  }

  return response
}

function forwardedRequestHeaders(
  request: NextRequest,
  requestId: string,
  requestPath: string,
  csp: string,
  nonce: string,
  joinJourneyToken: string | undefined,
  customerDeviceId: string | undefined
) {
  const requestHeaders = new Headers(request.headers)
  applyTrustedProxyOriginHeaders(requestHeaders)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(REQUEST_PATH_HEADER, requestPath)
  requestHeaders.delete(CUSTOMER_DEVICE_HEADER)
  if (customerDeviceId) {
    requestHeaders.set(CUSTOMER_DEVICE_HEADER, customerDeviceId)
  }
  if (joinJourneyToken) {
    requestHeaders.set(JOIN_JOURNEY_HEADER, joinJourneyToken)
  }
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const cookies = request.cookies.getAll()
  if (cookies.length > 0) {
    requestHeaders.set(
      "cookie",
      cookies.map(({ name, value }) => `${name}=${value}`).join("; ")
    )
  }

  return requestHeaders
}

function applyTrustedProxyOriginHeaders(requestHeaders: Headers): void {
  const forwardedHost = requestHeaders.get("x-forwarded-host")
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")

  requestHeaders.delete("x-forwarded-host")
  requestHeaders.delete("x-forwarded-proto")

  // Vercel sets this server-side runtime variable. Outside that declared
  // boundary, forwarded origin headers remain untrusted client input.
  if (process.env.VERCEL !== "1") return
  if (
    !forwardedHost ||
    !forwardedProtocol ||
    !FORWARDED_HOST_PATTERN.test(forwardedHost) ||
    !FORWARDED_PROTOCOL_PATTERN.test(forwardedProtocol)
  ) {
    return
  }

  requestHeaders.set("x-forwarded-host", forwardedHost)
  requestHeaders.set("x-forwarded-proto", forwardedProtocol)
}

function isOperationalProbePath(pathname: string): boolean {
  return pathname === "/api/health" || pathname === "/api/readiness"
}

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

function resolveCustomerDevice(request: NextRequest): {
  readonly id: string
  readonly token: string
  readonly isNew: boolean
} {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  const current = request.cookies.get(CUSTOMER_DEVICE_COOKIE)?.value
  if (current && secret) {
    const verified = verifyCustomerDeviceToken(current, secret)
    if (verified) return { id: verified, token: current, isNew: false }
  }
  const id = crypto.randomUUID()
  return {
    id,
    token: secret ? issueCustomerDeviceToken(id, secret) : id,
    isNew: true,
  }
}

function resolveJoinJourney(
  request: NextRequest
): { readonly token: string; readonly isNew: boolean } | null {
  const startsJourney = isJoinJourneyPath(request.nextUrl.pathname)
  const continuesJourney = request.nextUrl.pathname.startsWith("/card/")
  if (!startsJourney && !continuesJourney) return null
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret || secret.length < 16) return null

  const current = request.cookies.get(JOIN_JOURNEY_COOKIE)?.value
  if (current && verifyFunnelToken(current, secret, Date.now())) {
    return { token: current, isNew: false }
  }
  if (!startsJourney) return null

  return {
    token: issueFunnelToken(crypto.randomUUID(), secret, Date.now()),
    isNew: true,
  }
}

export const config = {
  // Run on stateful surfaces plus the exact public root. The root receives a
  // request nonce without auth refresh/device state; all other brochure pages
  // stay outside Proxy and retain framework/CDN caching.
  matcher: [
    "/",
    "/api/:path*",
    "/app/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/card/:path*",
    "/claim/:path*",
    "/demo/:path*",
    "/dev/:path*",
    "/home/:path*",
    "/login",
    "/m/:path*",
    "/merchant/:path*",
    "/offer/:path*",
    "/offline",
    "/p/:path*",
    "/pass/:path*",
    "/q/:path*",
    "/r/:path*",
    "/reset-password",
    "/reward/:path*",
    "/scan/:path*",
    "/signup/:path*",
    "/start/:path*",
  ],
}
