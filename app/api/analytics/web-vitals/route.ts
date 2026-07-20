import { NextResponse, type NextRequest } from "next/server"

import {
  MAX_WEB_VITAL_BODY_BYTES,
  parseWebVitalSample,
} from "@/lib/analytics/web-vitals-contract"
import { recordWebVitalSample } from "@/lib/analytics/web-vitals"
import {
  isJsonRequest,
  isSameOriginRequest,
  parseJson,
  readBoundedRequestBody,
} from "@/lib/http/bounded-json-request"
import {
  RateLimitError,
  enforceRateLimit,
  trustedClientIp,
} from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000
const NO_STORE_HEADERS = { "cache-control": "no-store, max-age=0" } as const

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse(403)
  if (!isJsonRequest(request)) return errorResponse(415)

  const declaredLength = request.headers.get("content-length")
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_WEB_VITAL_BODY_BYTES)
  ) {
    return errorResponse(413)
  }

  try {
    await enforceRateLimit({
      key: `analytics-web-vitals-ip:${trustedClientIp(request.headers)}`,
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    })
  } catch (error) {
    return error instanceof RateLimitError
      ? errorResponse(429)
      : errorResponse(503)
  }

  const text = await readBoundedRequestBody(request, MAX_WEB_VITAL_BODY_BYTES)
  if (text === null) return errorResponse(413)

  const sample = parseWebVitalSample(parseJson(text))
  if (!sample) return errorResponse(400)

  try {
    await recordWebVitalSample(sample)
    return new NextResponse(null, { status: 202, headers: NO_STORE_HEADERS })
  } catch {
    return errorResponse(503)
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
