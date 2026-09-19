import {
  createCipheriv,
  createDecipheriv,
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
const VERSION_PREFIX = "v1"
const TAG_BYTES = 16

export type PhonePii = {
  phoneHmac: string
  phoneCiphertext: string
  phoneLast4: string
}

export class CustomerPhoneCipherIntegrityError extends Error {
  constructor() {
    super("Customer phone ciphertext failed integrity verification.")
    this.name = "CustomerPhoneCipherIntegrityError"
  }
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
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv, {
    authTagLength: TAG_BYTES,
  })
  const ciphertext = Buffer.concat([
    cipher.update(e164, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    VERSION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptCustomerPhone(stored: string): string {
  const parts = stored.split(".")
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new CustomerPhoneCipherIntegrityError()
  }

  const [, ivPart, tagPart, bodyPart] = parts
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cipherKey(),
      Buffer.from(ivPart, "base64url"),
      { authTagLength: TAG_BYTES }
    )
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch (error) {
    if (error instanceof Error && /required/.test(error.message)) throw error
    throw new CustomerPhoneCipherIntegrityError()
  }
}

export function maskedPhoneFromLast4(last4: string | null): string | null {
  if (!last4) return null

  return `Phone ending ${last4}`
}

function lastFourDigits(e164: string): string {
  return e164.replace(/\D/g, "").slice(-4)
}

function cipherKey(): Buffer {
  return createHash("sha256").update(requiredEnv(encryptionKeyName)).digest()
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required for customer phone identity.`)
  }

  return value
}
