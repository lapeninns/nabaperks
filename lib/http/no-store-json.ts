import { NextResponse } from "next/server"

/**
 * Shared cache policy for authenticated APIs, cron endpoints, and anonymous
 * beacons: every payload reflects live server state and must never be served
 * by a browser, proxy, or bfcache.
 */
export const NO_STORE_HEADERS = {
  "cache-control": "no-store, max-age=0",
} as const

/** JSON response carrying the shared no-store cache policy. */
export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS })
}

/** Body-less response carrying the shared no-store cache policy. */
export function noStoreEmpty(status: number) {
  return new NextResponse(null, { status, headers: NO_STORE_HEADERS })
}

/**
 * Uniform error body for the anonymous analytics beacons. Everything except
 * throttling and downstream outages collapses to `invalid_request` so the
 * public endpoints reveal nothing about which guard rejected the request.
 */
export function beaconErrorResponse(status: 400 | 403 | 413 | 415 | 429 | 503) {
  const error =
    status === 429
      ? "rate_limited"
      : status === 503
        ? "temporarily_unavailable"
        : "invalid_request"

  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
