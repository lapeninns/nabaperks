import {
  createCustomerSessionCookieValue,
  readCustomerSessionCookieValue,
} from "@/lib/customer/session-cookie-core"

/**
 * Rolling renewal for the customer session cookie.
 *
 * The server-side session never expires, so the only thing that can lapse is
 * the browser cookie. Each renewal re-signs the same session with a fresh
 * expiry, keeping the signed expiry and the cookie's own Expires in step: the
 * cookie is never stretched past what its signature says.
 *
 * Renewal is throttled the way Auth.js and Better Auth throttle theirs:
 * re-sign only once `expiresAt - ttl + renewAfter` has passed, so a busy
 * customer gets at most one Set-Cookie a day.
 *
 * Returns the renewed cookie value, or null when the cookie is missing,
 * forged, expired, or not yet due. Validity against the database is still
 * checked on every request by the session touch; renewing a revoked session's
 * cookie grants nothing.
 */
export function renewCustomerSessionCookieValue({
  value,
  secret,
  nowSeconds,
  ttlSeconds,
  renewAfterSeconds,
}: {
  value: string | undefined
  secret: string | undefined
  nowSeconds: number
  ttlSeconds: number
  renewAfterSeconds: number
}): string | null {
  if (!value || !secret) return null

  const current = readCustomerSessionCookieValue(value, secret, nowSeconds)
  if (!current.ok) return null

  const renewDueAt = current.payload.expiresAt - ttlSeconds + renewAfterSeconds
  if (nowSeconds < renewDueAt) return null

  return createCustomerSessionCookieValue(
    { ...current.payload, expiresAt: nowSeconds + ttlSeconds },
    secret
  )
}
