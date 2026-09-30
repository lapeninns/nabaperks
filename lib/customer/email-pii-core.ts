import { createHmac } from "node:crypto"

/**
 * Pure customer-email PII codec for INVITE matching (no `server-only`, no
 * Supabase) so the HMAC invariants unit-test directly. An invite stores the
 * email only as an HMAC (never raw); `CUSTOMER_EMAIL_HMAC_SECRET` is the lookup
 * key. Mirrors lib/customer/phone-pii-core.ts.
 */

const hmacSecretName = "CUSTOMER_EMAIL_HMAC_SECRET"

/**
 * Normalize for matching: trim every Unicode edge whitespace (`trim()` covers
 * tab, no-break space, U+3000 and the rest), lowercase, then Unicode NFC so a
 * composed and a decomposed accent are one address. The verified-address
 * unique index keys on the same expression
 * (20261009110100_verified_email_address_unicode_index.sql). Deliberately NO
 * plus-address folding — a false-positive attach (gifting the wrong inbox) is
 * worse than a miss, and the claim link covers a genuine miss.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFC")
}

export function customerEmailHmac(email: string): string {
  return createHmac("sha256", requiredEnv(hmacSecretName))
    .update(normalizeEmail(email))
    .digest("hex")
}

/** "regular@example.com" -> "r***@example.com" (readback for the merchant). */
export function maskEmail(email: string): string | null {
  const normalized = normalizeEmail(email)
  const at = normalized.indexOf("@")
  if (at <= 0 || at === normalized.length - 1) return null
  return `${normalized[0]}***@${normalized.slice(at + 1)}`
}

/** A minimal shape check — the send flow decides email vs phone by the "@". */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim()
  const at = trimmed.indexOf("@")
  return at > 0 && at < trimmed.length - 1 && !trimmed.includes(" ")
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required for customer email identity.`)
  }
  return value
}
