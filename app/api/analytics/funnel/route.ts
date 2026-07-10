import { NextResponse, type NextRequest } from "next/server"

import {
  MAX_FUNNEL_BODY_BYTES,
  parseFunnelCaptureRequest,
} from "@/lib/analytics/funnel-contract"
import { recordAnonymousFunnelEvent } from "@/lib/analytics/funnel-events"
import {
  RateLimitError,
  enforceRateLimit,
  trustedClientIp,
} from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FUNNEL_RATE_LIMIT = 30
const FUNNEL_RATE_WINDOW_MS = 60_000
const NO_STORE_HEADERS = { "cache-control": "no-store, max-age=0" } as const

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return errorResponse(403)
  if (!isJsonRequest(request)) return errorResponse(415)

  const declaredLength = request.headers.get("content-length")
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_FUNNEL_BODY_BYTES)
  ) {
    return errorResponse(413)
  }

  try {
    await enforceRateLimit({
      key: `analytics-funnel-ip:${trustedClientIp(request.headers)}`,
      limit: FUNNEL_RATE_LIMIT,
      windowMs: FUNNEL_RATE_WINDOW_MS,
    })
  } catch (error) {
    return error instanceof RateLimitError
      ? errorResponse(429)
      : errorResponse(503)
  }

  const text = await readBoundedBody(request)
  if (text === null) return errorResponse(413)

  const body = parseFunnelCaptureRequest(parseJson(text))
  if (!body) return errorResponse(400)

  try {
    const result = await recordAnonymousFunnelEvent({
      event: body.event,
      funnelToken: body.token,
    })

    return NextResponse.json(
      { token: result.token },
      { status: 202, headers: NO_STORE_HEADERS }
    )
  } catch {
    return errorResponse(503)
  }
}

function isSameOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")
  if (!requestOrigin) return false

  const requestUrl = new URL(request.url)
  const allowedOrigins = new Set([requestUrl.origin])
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",", 1)[0]
    ?.trim()
  const host = forwardedHost || request.headers.get("host")?.trim()
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
  const protocol = forwardedProtocol || requestUrl.protocol.replace(/:$/, "")

  if (host && /^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d+)?$/i.test(host)) {
    try {
      allowedOrigins.add(new URL(`${protocol}://${host}`).origin)
    } catch {
      return false
    }
  }

  try {
    const parsedOrigin = new URL(requestOrigin)
    return (
      parsedOrigin.origin === requestOrigin && allowedOrigins.has(requestOrigin)
    )
  } catch {
    return false
  }
}

function isJsonRequest(request: NextRequest) {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() === "application/json"
  )
}

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  if (!request.body) return ""

  const reader = request.body.getReader()
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const decoded: string[] = []
  let bytesRead = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      bytesRead += value.byteLength
      if (bytesRead > MAX_FUNNEL_BODY_BYTES) {
        await reader.cancel()
        return null
      }

      decoded.push(decoder.decode(value, { stream: true }))
    }

    decoded.push(decoder.decode())
    return decoded.join("")
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function errorResponse(status: 400 | 403 | 413 | 415 | 429 | 503) {
  const error =
    status === 429
      ? "rate_limited"
      : status === 503
        ? "temporarily_unavailable"
        : "invalid_request"

  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
