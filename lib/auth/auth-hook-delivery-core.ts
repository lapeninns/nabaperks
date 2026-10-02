import { createHash, createHmac } from "node:crypto"

export type AuthHookClaim =
  | { readonly status: "claimed"; readonly leaseId: string }
  | { readonly status: "replay" }
  | { readonly status: "busy" }

export function parseAuthHookClaim(value: unknown): AuthHookClaim | null {
  if (!isRecord(value) || typeof value.status !== "string") return null
  if (value.status === "replay" || value.status === "busy") {
    return { status: value.status }
  }
  if (
    value.status === "claimed" &&
    typeof value.lease_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.lease_id
    )
  ) {
    return { status: "claimed", leaseId: value.lease_id }
  }
  return null
}

/**
 * Delivery identity for one Supabase-generated email OTP.
 *
 * GoTrue's HTTP hook client mints a new `webhook-id` (and signs a new
 * timestamp) on every retry attempt, but sends the same payload bytes. Keying
 * the claim on the webhook id therefore treated each retry as a new delivery:
 * after an ambiguous provider failure the retry minted a second alias code and
 * superseded the one that may already have arrived. The key is instead derived
 * from the payload fields that stay fixed across the retries of one OTP.
 *
 * It is an HMAC under the hook secret, never a bare hash: the payload carries a
 * 6-digit OTP and the recipient, and a plain digest of those is brute-forceable.
 * A replayed envelope maps to the same key, so replay consumption still holds.
 */
export function authHookEmailDeliveryKey(
  secret: string,
  {
    action,
    email,
    token,
    userId,
  }: {
    readonly action: string
    readonly email: string
    readonly token: string
    readonly userId?: string
  }
) {
  return `email-otp:${createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "send-email-delivery:v1",
        userId ?? "",
        email,
        action,
        token,
      ])
    )
    .digest("hex")}`
}

export function authHookEmailIdempotencyKey(deliveryKey: string) {
  return `auth-hook-email:${createHash("sha256")
    .update(deliveryKey)
    .digest("hex")}`
}

export function authHookSmsChallengeDigest(
  secret: string,
  phone: string,
  code: string
) {
  return createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "send-sms-delivery:v1",
        phone.trim().replace(/^\+/, ""),
        code.trim(),
      ])
    )
    .digest("hex")
}

export function smsHookChallengeWindowSeconds(value: string | undefined) {
  const input = value?.trim() || "60"
  const seconds = Number(input)
  if (
    !/^\d+$/.test(input) ||
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    seconds > 86400
  ) {
    throw new Error("Invalid Supabase SMS OTP expiry.")
  }
  return seconds
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
