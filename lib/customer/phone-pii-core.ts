import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto"

/**
 * Pure customer-phone PII codec (no `server-only`, no Supabase) so the
 * HMAC/ciphertext/last4 invariants can be unit-tested directly
 * (see tests/unit/phone-pii.test.mjs). `phone-pii.ts` re-exports this behind the
 * server-only guard for app code. A phone number is NEVER stored as searchable
 * plaintext: `phone_hmac` is the lookup key, `phone_ciphertext` the reversible
 * store, `phone_last4` the readback.
 */

const hmacSecretName = "CUSTOMER_PHONE_HMAC_SECRET"
const encryptionKeyName = "CUSTOMER_PHONE_ENCRYPTION_KEY"

export type PhonePii = {
  phoneHmac: string
  phoneCiphertext: string
  phoneLast4: string
}

export function customerPhonePii(e164: string): PhonePii {
  return {
    phoneHmac: customerPhoneHmac(e164),
    phoneCiphertext: encryptCustomerPhone(e164),
    phoneLast4: lastFourDigits(e164),
  }
}

export function customerPhoneHmac(e164: string): string {
  return createHmac("sha256", requiredEnv(hmacSecretName))
    .update(e164)
    .digest("hex")
}

export function encryptCustomerPhone(e164: string): string {
  const key = createHash("sha256")
    .update(requiredEnv(encryptionKeyName))
    .digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(e164, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function maskedPhoneFromLast4(last4: string | null): string | null {
  if (!last4) return null

  return `Phone ending ${last4}`
}

function lastFourDigits(e164: string): string {
  return e164.replace(/\D/g, "").slice(-4)
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required for customer phone identity.`)
  }

  return value
}
