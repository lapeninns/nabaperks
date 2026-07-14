import assert from "node:assert/strict"
import { test } from "node:test"

process.env.CUSTOMER_PHONE_HMAC_SECRET ??= "unit-test-hmac-secret"
process.env.CUSTOMER_PHONE_ENCRYPTION_KEY ??= "unit-test-encryption-key"

const {
  customerPhonePii,
  customerPhoneHmac,
  encryptCustomerPhone,
  maskedPhoneFromLast4,
} = await import("@/lib/customer/phone-pii-core")

/**
 * customer auth wallet — AW-8 phone PII storage (unit tier).
 *
 * Proves a phone number is never stored as searchable plaintext: the HMAC is a
 * deterministic, non-reversible lookup key; the ciphertext is versioned AES-GCM
 * that round-trips to neither the plaintext nor a stable value (fresh IV); the
 * last4 is the readback.
 */

const PHONE = "+447700900123"
const OTHER = "+447700900999"

test("the HMAC is deterministic, hex, and not the plaintext", () => {
  const a = customerPhoneHmac(PHONE)
  const b = customerPhoneHmac(PHONE)
  assert.equal(a, b, "same number → same HMAC (usable as a lookup key)")
  assert.match(a, /^[0-9a-f]{64}$/, "HMAC is 32-byte hex (SHA-256)")
  assert.notEqual(a, PHONE, "the HMAC is not the phone number")
  assert.ok(!a.includes("447700900123"), "no digits of the number survive in the HMAC")
})

test("different numbers produce different HMACs", () => {
  assert.notEqual(customerPhoneHmac(PHONE), customerPhoneHmac(OTHER))
})

test("the ciphertext is versioned AES-GCM, never plaintext, with a fresh IV each time", () => {
  const one = encryptCustomerPhone(PHONE)
  const two = encryptCustomerPhone(PHONE)
  const parts = one.split(".")
  assert.equal(parts.length, 4, "format is v1.iv.tag.ciphertext")
  assert.equal(parts[0], "v1", "carries a version tag")
  assert.ok(!one.includes("447700900123"), "no digits of the number survive in the ciphertext")
  assert.notEqual(one, two, "a fresh random IV makes each encryption distinct")
})

test("customerPhonePii bundles hmac + ciphertext + last4 (no plaintext field)", () => {
  const pii = customerPhonePii(PHONE)
  assert.deepEqual(Object.keys(pii).sort(), ["phoneCiphertext", "phoneHmac", "phoneLast4"])
  assert.equal(pii.phoneLast4, "0123", "last4 is the final four digits")
  assert.equal(pii.phoneHmac, customerPhoneHmac(PHONE), "hmac matches the standalone codec")
  assert.ok(!JSON.stringify(pii).includes("447700900123"), "the bundle never carries the full number")
})

test("maskedPhoneFromLast4 renders a readback label, null-safe", () => {
  assert.equal(maskedPhoneFromLast4("0123"), "Phone ending 0123")
  assert.equal(maskedPhoneFromLast4(null), null)
})

test("the codec throws if the secret env is missing", async () => {
  const saved = process.env.CUSTOMER_PHONE_HMAC_SECRET
  process.env.CUSTOMER_PHONE_HMAC_SECRET = ""
  assert.throws(() => customerPhoneHmac(PHONE), /CUSTOMER_PHONE_HMAC_SECRET is required/)
  process.env.CUSTOMER_PHONE_HMAC_SECRET = saved
})
