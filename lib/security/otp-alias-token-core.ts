import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Pure at-rest codec for merchant_email_otp_aliases.supabase_token (no
 * `server-only`, no Supabase) so the encryption invariants can be unit-tested
 * directly (see tests/unit/merchant-email-otp-alias-encryption.test.mjs).
 * `otp-alias-token.ts` re-exports this behind the server-only guard.
 *
 * auth otp alias token encryption: the stored value is a usable Supabase
 * login token for its ≤60-minute lifetime, so it is never written as
 * plaintext. Format mirrors the customer phone codec:
 * `v1.<iv>.<tag>.<ciphertext>` (base64url, AES-256-GCM, fresh IV per row).
 * A stored value WITHOUT the version prefix is a legacy pre-deploy row and
 * passes through unchanged during the one-hour compatibility window.
 */

const encryptionKeyName = "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY"
const VERSION_PREFIX = "v1"

/** A versioned value that fails parsing or auth-tag verification. */
export class OtpAliasTokenIntegrityError extends Error {
  constructor() {
    super("Merchant OTP alias token failed integrity verification.")
    this.name = "OtpAliasTokenIntegrityError"
  }
}

export function encryptOtpAliasToken(token: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

export function decryptOtpAliasToken(stored: string): string {
  if (!stored.startsWith(`${VERSION_PREFIX}.`)) {
    // Legacy plaintext row from before the encryption deploy; rows live at
    // most 60 minutes, so this branch drains itself.
    return stored
  }

  const parts = stored.split(".")
  if (parts.length !== 4) throw new OtpAliasTokenIntegrityError()

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
    throw new OtpAliasTokenIntegrityError()
  }
}

function cipherKey(): Buffer {
  return createHash("sha256").update(requiredEnv(encryptionKeyName)).digest()
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required for merchant OTP alias tokens.`)
  }

  return value
}
