import assert from "node:assert/strict"
import { test } from "node:test"

process.env.MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY ??=
  "unit-test-otp-alias-encryption-key"

const {
  OtpAliasTokenIntegrityError,
  decryptOtpAliasToken,
  encryptOtpAliasToken,
} = await import("@/lib/security/otp-alias-token-core")

/**
 * auth otp alias token encryption — the at-rest token codec (unit tier).
 *
 * merchant_email_otp_aliases.supabase_token stored a usable Supabase login
 * token in plaintext for its ≤60-minute lifetime. These tests pin the codec:
 * versioned AES-256-GCM at rest, fresh IV per row, tamper rejection via the
 * auth tag, a legacy-plaintext fallback for rows written before the deploy,
 * and fail-closed behavior when the key is absent.
 */

const TOKEN = "pkce_1234567890abcdefghijklmnopqrstuvwxyz"

test("a token round-trips through encrypt/decrypt", () => {
  const stored = encryptOtpAliasToken(TOKEN)
  assert.equal(decryptOtpAliasToken(stored), TOKEN, "decrypt returns the original token")
})

test("the stored value is versioned ciphertext, not the plaintext", () => {
  const stored = encryptOtpAliasToken(TOKEN)
  assert.match(stored, /^v1\./, "the value is self-describing (v1 prefix) for rotation")
  assert.ok(!stored.includes(TOKEN), "the plaintext token never appears at rest")
})

test("every encryption uses a fresh IV", () => {
  const a = encryptOtpAliasToken(TOKEN)
  const b = encryptOtpAliasToken(TOKEN)
  assert.notEqual(a, b, "identical tokens produce different ciphertext (fresh IV)")
})

test("a tampered value fails auth-tag verification as an integrity error", () => {
  const stored = encryptOtpAliasToken(TOKEN)
  const parts = stored.split(".")
  // Tamper in byte space: swapping a base64url CHARACTER can be a no-op when
  // it only changes the encoding's ignored trailing bits (which made this
  // test flake); flipping a decoded byte is a guaranteed real change.
  const body = Buffer.from(parts[3], "base64url")
  body[0] ^= 0x01
  const tampered = [parts[0], parts[1], parts[2], body.toString("base64url")].join(".")

  assert.throws(
    () => decryptOtpAliasToken(tampered),
    OtpAliasTokenIntegrityError,
    "tampered ciphertext must be rejected, never passed through"
  )
})

test("a malformed versioned value is an integrity error, not plaintext", () => {
  assert.throws(
    () => decryptOtpAliasToken("v1.not-a-real-shape"),
    OtpAliasTokenIntegrityError,
    "a v1-prefixed value that does not parse must be rejected"
  )
})

test("a legacy plaintext value (no version prefix) passes through unchanged", () => {
  assert.equal(
    decryptOtpAliasToken(TOKEN),
    TOKEN,
    "pre-deploy rows (≤60 min old) keep consuming during the compatibility window"
  )
})

test("encryption fails closed when the key is absent", () => {
  const saved = process.env.MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY
  delete process.env.MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY
  try {
    assert.throws(
      () => encryptOtpAliasToken(TOKEN),
      /MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY/,
      "no key → no plaintext write; alias creation must error loudly"
    )
  } finally {
    process.env.MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY = saved
  }
})
