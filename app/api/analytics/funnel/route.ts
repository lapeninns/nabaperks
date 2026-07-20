import { type NextRequest } from "next/server"

import {
  MAX_FUNNEL_BODY_BYTES,
  parseFunnelCaptureRequest,
} from "@/lib/analytics/funnel-contract"
import { recordAnonymousFunnelEvent } from "@/lib/analytics/funnel-events"
import {
  isJsonRequest,
  isSameOriginRequest,
  parseJson,
  readBoundedRequestBody,
} from "@/lib/http/bounded-json-request"
import {
  beaconErrorResponse as errorResponse,
  noStoreJson,
} from "@/lib/http/no-store-json"
import {
  RateLimitError,
  enforceRateLimit,
  trustedClientIp,
} from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FUNNEL_RATE_LIMIT = 30
const FUNNEL_RATE_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse(403)
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

  const text = await readBoundedRequestBody(request, MAX_FUNNEL_BODY_BYTES)
  if (text === null) return errorResponse(413)

  const body = parseFunnelCaptureRequest(parseJson(text))
  if (!body) return errorResponse(400)

  try {
    const result = await recordAnonymousFunnelEvent({
      event: body.event,
      funnelToken: body.token,
    })

    return noStoreJson({ token: result.token }, 202)
  } catch {
    return errorResponse(503)
  }
}
