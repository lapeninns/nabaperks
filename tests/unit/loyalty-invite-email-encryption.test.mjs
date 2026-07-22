import assert from "node:assert/strict"
import { test } from "node:test"

process.env.CUSTOMER_EMAIL_ENCRYPTION_KEY ??=
  "unit-test-loyalty-invite-email-encryption-key-000000"

const {
  encryptCustomerEmail,
  decryptCustomerEmail,
  CustomerEmailCipherIntegrityError,
} = await import("@/lib/customer/email-encryption-core")

/**
 * Reversible at-rest codec for a bulk-invitation recipient's email. The
 * ciphertext is stored only long enough to send, then scrubbed.
 */

test("round-trips a normalised address", () => {
  const stored = encryptCustomerEmail("Regular@Example.com")
  assert.match(stored, /^v1\./)
  assert.equal(decryptCustomerEmail(stored), "regular@example.com")
})

test("uses a fresh IV so two encryptions differ", () => {
  const a = encryptCustomerEmail("regular@example.com")
  const b = encryptCustomerEmail("regular@example.com")
  assert.notEqual(a, b)
  assert.equal(decryptCustomerEmail(a), decryptCustomerEmail(b))
})

test("rejects tampered ciphertext", () => {
  const stored = encryptCustomerEmail("regular@example.com")
  const parts = stored.split(".")
  parts[3] = Buffer.from("tampered").toString("base64url")
  assert.throws(
    () => decryptCustomerEmail(parts.join(".")),
    CustomerEmailCipherIntegrityError
  )
})

test("rejects a non-versioned (plaintext) value — no legacy passthrough", () => {
  assert.throws(
    () => decryptCustomerEmail("regular@example.com"),
    CustomerEmailCipherIntegrityError
  )
})

test("fails closed when the key is missing", async () => {
  const previous = process.env.CUSTOMER_EMAIL_ENCRYPTION_KEY
  delete process.env.CUSTOMER_EMAIL_ENCRYPTION_KEY
  try {
    assert.throws(
      () => encryptCustomerEmail("regular@example.com"),
      /CUSTOMER_EMAIL_ENCRYPTION_KEY is required/
    )
  } finally {
    process.env.CUSTOMER_EMAIL_ENCRYPTION_KEY = previous
  }
})
