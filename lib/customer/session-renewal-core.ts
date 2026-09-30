import {
  createCustomerSessionCookieValue,
  readCustomerSessionCookieValue,
  type CustomerSessionPayload,
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
 * forged, expired, or not yet due. The signature says nothing about the
 * server-side row, so a due renewal must still pass
 * `confirmCustomerSessionRenewal` before it is set.
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

/** Whether the database still accepts this session on this device. */
export type CustomerSessionActivityCheck = (
  session: Pick<CustomerSessionPayload, "customerId" | "sessionId">
) => Promise<boolean>

/**
 * What the proxy does with the session cookie once a due renewal is checked:
 * re-sign it, clear it, or leave it as presented.
 */
export type CustomerSessionRenewalOutcome =
  | { readonly action: "renew"; readonly value: string }
  | { readonly action: "clear" }
  | { readonly action: "keep" }

const KEEP: CustomerSessionRenewalOutcome = { action: "keep" }

/**
 * Gate a due renewal on the server-side session.
 *
 * - Active: the re-signed cookie is set for another full window.
 * - Not active (revoked, expired, deleted or bound to another device): the
 *   cookie is cleared, so the browser stops presenting a session that can
 *   never be used again and the proxy stops asking the database about it.
 * - Unanswered (network, 5xx, missing configuration): nothing changes. The
 *   cookie stays valid for the rest of its window and the next due request
 *   asks again.
 *
 * The check runs only for a renewal that is already due, so a signed-in
 * browser pays for it at most once a day.
 */
export async function confirmCustomerSessionRenewal({
  renewed,
  secret,
  nowSeconds,
  isSessionActive,
}: {
  renewed: string | null
  secret: string | undefined
  nowSeconds: number
  isSessionActive: CustomerSessionActivityCheck
}): Promise<CustomerSessionRenewalOutcome> {
  if (!renewed || !secret) return KEEP

  const session = readCustomerSessionCookieValue(renewed, secret, nowSeconds)
  if (!session.ok) return KEEP

  let active: boolean
  try {
    active = await isSessionActive(session.payload)
  } catch {
    return KEEP
  }
  return active ? { action: "renew", value: renewed } : { action: "clear" }
}
