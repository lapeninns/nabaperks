import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// contract-auth-otp-alias-token-encryption — pins the wiring contract:
//   1. alias creation stores the token through encryptOtpAliasToken (no
//      plaintext write path remains),
//   2. consume decrypts server-side and treats integrity failures as an
//      invalid token (not a passthrough, not a crash),
//   3. the codec is the house AES-256-GCM pattern with a version prefix, and
//   4. the server-only key is declared in the env contract.
// The codec behavior itself is proven by
// tests/unit/merchant-email-otp-alias-encryption.test.mjs.

const aliasLib = readFileSync("lib/auth/merchant-email-otp-alias.ts", "utf8")
const core = readFileSync("lib/security/otp-alias-token-core.ts", "utf8")
const contract = readFileSync("config/env-contract.json", "utf8")

test("alias creation encrypts the token at rest", () => {
  assert.match(
    aliasLib,
    /supabase_token:\s*encryptOtpAliasToken\(/,
    "the insert must store ciphertext, never the raw token"
  )
})

test("consume decrypts server-side and maps integrity failures to invalid", () => {
  assert.match(aliasLib, /decryptOtpAliasToken\(/, "consume must decrypt the stored value")
  assert.match(
    aliasLib,
    /OtpAliasTokenIntegrityError/,
    "integrity failures must be handled as an invalid token"
  )
})

test("the codec is versioned AES-256-GCM", () => {
  assert.match(core, /aes-256-gcm/, "the house cipher is used")
  assert.match(core, /"v1"/, "the stored format carries a version prefix for rotation")
  assert.match(
    core,
    /MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY/,
    "the dedicated server-only key derives the cipher key"
  )
})

test("the encryption key is declared in the env contract as server-only", () => {
  const entries = JSON.parse(contract)
  const entry = entries.find(
    (candidate) => candidate.name === "MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY"
  )
  assert.ok(entry, "config/env-contract.json must declare the key")
  assert.equal(entry.visibility, "server", "the key must never reach client bundles")
})
