import { OFFER_PASS_SCAN_TOKEN_TTL_MS } from "@/lib/offers/constants"

/**
 * Pure helpers for the customer-held discount-pass QR.
 *
 * The scan token encoded in the QR lives for ten minutes
 * (`offer_pass_scan_tokens.expires_at` default, mirrored by
 * OFFER_PASS_SCAN_TOKEN_TTL_MS — imported here, never redeclared, so the two
 * cannot drift). A member who joins a queue with a QR fetched once on mount can
 * reach the counter holding a code that has already died, so the presented
 * image re-fetches well inside that TTL. The server reuses a token with enough
 * life left for the next scheduled refresh and mints a new one otherwise.
 *
 * Mirrors lib/customer/reward-qr.ts, which does the same job for reward codes.
 */

/**
 * How often the pass QR re-fetches. Half the TTL guarantees at least one
 * refresh lands before the presented code could go stale, without hammering the
 * mint route on every render.
 */
export function offerPassQrRefreshIntervalMs(): number {
  return OFFER_PASS_SCAN_TOKEN_TTL_MS / 2
}

/**
 * Cache-busted `qr.png` URL for one pass. `tick` advances on each refresh so the
 * browser fetches a server-authoritative image instead of serving a cached one.
 * The base path stays `/pass/<entitlementId>/qr.png` so a request without a
 * query hits exactly the same protected route.
 */
export function offerPassQrCacheBustedSrc(
  entitlementId: string,
  tick: number
): string {
  return `/pass/${encodeURIComponent(entitlementId)}/qr.png?t=${tick}`
}

/**
 * What the QR image actually encodes: the public `/p/<scanToken>` handoff, which
 * redirects a logged-in merchant into the read-only staff screen. The origin is
 * supplied by the caller (NEXT_PUBLIC_APP_URL) so this stays pure.
 */
export function offerPassScanUrl(appOrigin: string, scanToken: string): string {
  return `${appOrigin.replace(/\/+$/, "")}/p/${encodeURIComponent(scanToken)}`
}
