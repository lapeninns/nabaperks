import {
  createEncryptedPendingCookieValue,
  readEncryptedPendingCookieValue,
  type EncryptedPendingCookieReadResult,
} from "@/lib/customer/pending-cookie-crypto"

/**
 * The record that a signed-out phone attempt has opened the email fallback
 * (lib/customer/email-fallback.ts). It names only the flow and why, never a
 * number or an address, and lasts as long as a pending code.
 */
export const EMAIL_FALLBACK_COOKIE_NAME = "nabaperks_email_fallback"
export const EMAIL_FALLBACK_TTL_SECONDS = 10 * 60

/** The join page, or /home/login opening a wallet. */
export type EmailFallbackPurpose = "join" | "wallet"

/**
 * Why email opened: no phone code could be sent, the number holds no cards,
 * or the customer took email once the phone code's wait was over.
 */
export type EmailFallbackReason = "phone_send_failed" | "no_cards" | "opened"

export type EmailFallbackPayload = {
  readonly version: 1
  readonly purpose: EmailFallbackPurpose
  readonly reason: EmailFallbackReason
  readonly issuedAt: number
  readonly expiresAt: number
}

export function createEmailFallbackCookieValue(
  payload: EmailFallbackPayload,
  secret: string
): string {
  return createEncryptedPendingCookieValue({
    payload,
    secret,
    context: "email-fallback",
  })
}

export function readEmailFallbackCookieValue(
  value: string,
  secret: string,
  nowSeconds: number
): EncryptedPendingCookieReadResult<EmailFallbackPayload> {
  return readEncryptedPendingCookieValue({
    value,
    secret,
    context: "email-fallback",
    nowSeconds,
    parse: parseEmailFallbackPayload,
  })
}

function parseEmailFallbackPayload(
  value: unknown
): EmailFallbackPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const { version, purpose, reason, issuedAt, expiresAt } = record
  if (version !== 1) return null
  if (purpose !== "join" && purpose !== "wallet") return null
  if (
    reason !== "phone_send_failed" &&
    reason !== "no_cards" &&
    reason !== "opened"
  ) {
    return null
  }
  if (typeof issuedAt !== "number" || typeof expiresAt !== "number") {
    return null
  }
  return { version, purpose, reason, issuedAt, expiresAt }
}
