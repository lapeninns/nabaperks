import assert from "node:assert/strict"
import { test } from "node:test"

import fc from "fast-check"

process.env.CUSTOMER_PHONE_HMAC_SECRET ??= "unit-test-hmac-secret"
process.env.CUSTOMER_PHONE_ENCRYPTION_KEY ??= "unit-test-encryption-key"

const { customerPhonePii, customerPhoneHmac, encryptCustomerPhone } =
  await import("@/lib/customer/phone-pii-core")

const phoneArbitrary = fc
  .integer({ min: 0, max: 999_999_999 })
  .map((value) => `+4477${String(value).padStart(9, "0")}`)

test("Given arbitrary phone numbers When HMACs are generated Then the lookup key is stable and non-plaintext", () => {
  fc.assert(
    fc.property(phoneArbitrary, (phone) => {
      const first = customerPhoneHmac(phone)
      const second = customerPhoneHmac(phone)

      assert.equal(first, second)
      assert.match(first, /^[0-9a-f]{64}$/)
      assert.ok(!first.includes(phone.replace(/\D/g, "")))
    }),
    { numRuns: 100 }
  )
})

test("Given distinct phone numbers When HMACs are generated Then lookup keys differ", () => {
  fc.assert(
    fc.property(phoneArbitrary, phoneArbitrary, (firstPhone, secondPhone) => {
      fc.pre(firstPhone !== secondPhone)

      assert.notEqual(
        customerPhoneHmac(firstPhone),
        customerPhoneHmac(secondPhone)
      )
    }),
    { numRuns: 100 }
  )
})

test("Given arbitrary phone numbers When encrypted Then ciphertext is versioned and does not carry digits", () => {
  fc.assert(
    fc.property(phoneArbitrary, (phone) => {
      const encrypted = encryptCustomerPhone(phone)
      const parts = encrypted.split(".")

      assert.equal(parts.length, 4)
      assert.equal(parts[0], "v1")
      assert.ok(!encrypted.includes(phone.replace(/\D/g, "")))
    }),
    { numRuns: 100 }
  )
})

test("Given arbitrary phone numbers When PII is bundled Then only the last four digits are readable", () => {
  fc.assert(
    fc.property(phoneArbitrary, (phone) => {
      const pii = customerPhonePii(phone)
      const digits = phone.replace(/\D/g, "")

      assert.deepEqual(Object.keys(pii).sort(), [
        "phoneCiphertext",
        "phoneHmac",
        "phoneLast4",
      ])
      assert.equal(pii.phoneLast4, digits.slice(-4))
      assert.ok(!JSON.stringify(pii).includes(digits))
    }),
    { numRuns: 100 }
  )
})
