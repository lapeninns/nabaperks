/**
 * First-party cookie attributes that survive Safari process death.
 *
 * iOS Safari treats Max-Age-only cookies as session cookies and discards them
 * when the WebKit process is killed. Pairing an absolute Expires date keeps
 * the customer session and device cookies across tab closes.
 */
export type PersistentCookieOptions = {
  readonly httpOnly: true
  readonly sameSite: "lax"
  readonly secure: boolean
  readonly path: "/"
  readonly maxAge: number
  readonly expires: Date
}

export const CUSTOMER_DEVICE_COOKIE = "nabaperks_device"
export const CUSTOMER_DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60
export const CUSTOMER_SESSION_COOKIE = "nabaperks_customer_session"
/**
 * A customer stays signed in until they log out. The server-side session row
 * never expires; this is only the browser cookie's rolling window, re-signed
 * on visits (see session-renewal-core.ts). It matches the device cookie because
 * a session is bound to its device and cannot outlive it.
 */
export const CUSTOMER_SESSION_TTL_SECONDS = CUSTOMER_DEVICE_TTL_SECONDS
/** Re-sign the session cookie at most once per day of use. */
export const CUSTOMER_SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60

export function persistentCookieOptions(
  maxAgeSeconds: number,
  nowMs: number = Date.now()
): PersistentCookieOptions {
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds))
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    expires: new Date(nowMs + maxAge * 1_000),
  }
}
