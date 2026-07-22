import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

import { normalizeEmail } from "@/lib/customer/email-pii-core"

/**
 * Reversible at-rest codec for a bulk-loyalty-invitation recipient's email
 * address (no `server-only`, no Supabase, so the encryption invariants unit-test
 * directly — see tests/unit/loyalty-invite-email-encryption.test.mjs).
 *
 * lib/customer/email-pii-core.ts stores an email HMAC-only for matching; a
 * campaign additionally has to retain the *actual* address long enough to send
 * the invitation, so the value is stored as AES-256-GCM ciphertext — never
 * plaintext, never logged — and decrypted only inside the delivery worker. The
 * ciphertext is scrubbed the moment a recipient reaches a terminal state
 * (claimed / cancelled / expired).
 *
 * Format mirrors the phone and OTP-alias codecs: `v1.<iv>.<tag>.<ciphertext>`
 * (base64url, AES-256-GCM, a fresh IV per row). The input is normalised so the
 * stored ciphertext always resolves to the same address as its HMAC.
 */

const encryptionKeyName = "CUSTOMER_EMAIL_ENCRYPTION_KEY"
const VERSION_PREFIX = "v1"

/** A stored value that fails parsing or auth-tag verification. */
export class CustomerEmailCipherIntegrityError extends Error {
  constructor() {
    super("Customer email ciphertext failed integrity verification.")
    this.name = "CustomerEmailCipherIntegrityError"
  }
}

export function encryptCustomerEmail(email: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(normalizeEmail(email), "utf8"),
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

export function decryptCustomerEmail(stored: string): string {
  const parts = stored.split(".")
  // Unlike the OTP-alias codec there is no legacy plaintext to pass through:
  // every recipient address is written encrypted, so a non-versioned value is
  // always a tamper/corruption signal.
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new CustomerEmailCipherIntegrityError()
  }

  const [, ivPart, tagPart, bodyPart] = parts
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cipherKey(),
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(bodyPart, "base64url")),
      decipher.final(),
    ])
    return plaintext.toString("utf8")
  } catch (error) {
    if (error instanceof Error && /required/.test(error.message)) throw error
    throw new CustomerEmailCipherIntegrityError()
  }
}

function cipherKey(): Buffer {
  return createHash("sha256").update(requiredEnv(encryptionKeyName)).digest()
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required for loyalty invitation email storage.`)
  }
  return value
}
