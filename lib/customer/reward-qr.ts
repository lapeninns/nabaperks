/**
 * Pure helpers for the customer-held reward QR.
 *
 * The merchant-scan token encoded in the QR has a 10-minute TTL enforced at
 * scan time (`create_reward_scan_token` → `now() + interval '10 minutes'`). The
 * customer-facing QR image used to be fetched once on mount, so a customer who
 * queued at the counter could end up presenting a token that had already
 * expired. To keep the presented QR fresh we re-fetch `qr.png` on an interval
 * comfortably inside that TTL — each fetch mints a new token server-side.
 */

/** Scan-token TTL enforced in Postgres (`now() + interval '10 minutes'`). */
export const REWARD_SCAN_TOKEN_TTL_MS = 10 * 60_000

/**
 * How often the customer QR re-fetches a fresh token. Half the TTL guarantees at
 * least one refresh lands before the presented token could go stale, without
 * hammering the mint route on every render.
 */
export function rewardQrRefreshIntervalMs(): number {
  return REWARD_SCAN_TOKEN_TTL_MS / 2
}

/**
 * Cache-busted `qr.png` URL for a reward. The `tick` advances on each refresh so
 * the browser re-fetches (minting a fresh token) rather than serving a cached
 * image. The base path stays `/reward/{id}/qr.png` so the protected route — and
 * the e2e request that hits it without a query — is unchanged.
 */
export function rewardQrCacheBustedSrc(rewardId: string, tick: number): string {
  return `/reward/${rewardId}/qr.png?t=${tick}`
}
