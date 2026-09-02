import { type NextRequest } from "next/server"

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
  beaconErrorResponse as errorResponse,
  noStoreEmpty,
} from "@/lib/http/no-store-json"
import {
  RateLimitError,
  enforceRateLimit,
  trustedClientIp,
} from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request, process.env.NEXT_PUBLIC_APP_URL)) {
    return errorResponse(403)
  }
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
    return noStoreEmpty(202)
  } catch {
    return errorResponse(503)
  }
}
