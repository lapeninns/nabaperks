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
  dynamicContentSecurityPolicy,
  isStaticMarketingPath,
  staticMarketingContentSecurityPolicy,
} from "@/lib/security/csp"
import { CUSTOMER_DEVICE_HEADER } from "@/lib/security/rate-limit-core"
import {
  issueCustomerDeviceToken,
  verifyCustomerDeviceToken,
} from "@/lib/security/customer-device-token"
import { refreshSupabaseSession } from "@/lib/supabase/update-session"

const CUSTOMER_DEVICE_COOKIE = "nabaperks_device"
const CUSTOMER_DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), payment=(), usb=(), interest-cohort=(), geolocation=(self)",
} as const

// Next.js 16 Proxy (formerly middleware). Refreshes Supabase auth cookies on
// every request, then attaches observability and security headers. It reuses an
// inbound `x-request-id` (e.g. from a load balancer) or mints one, exposes it to
// server components and route handlers via the forwarded request headers, and
// echoes it on the response so clients and logs can be correlated end to end.
export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const nonce = isStaticMarketingPath(request.nextUrl.pathname)
    ? undefined
    : btoa(crypto.randomUUID())
  const csp =
    nonce === undefined
      ? staticMarketingContentSecurityPolicy()
      : dynamicContentSecurityPolicy(nonce)
  const joinJourney = resolveJoinJourney(request)
  const customerDevice = resolveCustomerDevice(request)

  const response = await refreshSupabaseSession(request, () => {
    const requestHeaders = forwardedRequestHeaders(
      request,
      requestId,
      requestPath,
      csp,
      nonce,
      joinJourney?.token,
      customerDevice.id
    )
    const nextResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })
    nextResponse.headers.set(REQUEST_ID_HEADER, requestId)
    nextResponse.headers.set("Content-Security-Policy", csp)
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      nextResponse.headers.set(header, value)
    }
    return nextResponse
  })

  if (joinJourney?.isNew) {
    response.cookies.set(JOIN_JOURNEY_COOKIE, joinJourney.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: JOIN_JOURNEY_TTL_SECONDS,
    })
  }

  if (customerDevice.isNew) {
    response.cookies.set(CUSTOMER_DEVICE_COOKIE, customerDevice.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CUSTOMER_DEVICE_TTL_SECONDS,
    })
  }

  return response
}

function forwardedRequestHeaders(
  request: NextRequest,
  requestId: string,
  requestPath: string,
  csp: string,
  nonce: string | undefined,
  joinJourneyToken: string | undefined,
  customerDeviceId: string
) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  requestHeaders.set(REQUEST_PATH_HEADER, requestPath)
  requestHeaders.set(CUSTOMER_DEVICE_HEADER, customerDeviceId)
  if (joinJourneyToken) {
    requestHeaders.set(JOIN_JOURNEY_HEADER, joinJourneyToken)
  }
  if (nonce !== undefined) {
    requestHeaders.set("x-nonce", nonce)
  }
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
  // Run on application routes; skip Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)",
  ],
}
