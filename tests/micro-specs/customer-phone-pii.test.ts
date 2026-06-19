import { createDecipheriv, createHash, createHmac } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  customerPhoneHmac,
  customerPhonePii,
  encryptCustomerPhone,
  maskedPhoneFromLast4,
} from "@/lib/customer/phone-pii"

const hmacSecret = "phone-hmac-secret-with-enough-entropy"
const encryptionKey = "phone-encryption-key-with-enough-entropy"
const phone = "+447911123456"

describe("customer phone PII", () => {
  beforeEach(() => {
    process.env.CUSTOMER_PHONE_HMAC_SECRET = hmacSecret
    process.env.CUSTOMER_PHONE_ENCRYPTION_KEY = encryptionKey
  })

  afterEach(() => {
    delete process.env.CUSTOMER_PHONE_HMAC_SECRET
    delete process.env.CUSTOMER_PHONE_ENCRYPTION_KEY
  })

  it("derives a stable keyed HMAC for a phone number", () => {
    const expected = createHmac("sha256", hmacSecret)
      .update(phone)
      .digest("hex")

    expect(customerPhoneHmac(phone)).toBe(expected)
    expect(customerPhoneHmac(phone)).toBe(customerPhoneHmac(phone))
    expect(customerPhoneHmac(phone)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("changes the HMAC when the secret changes", () => {
    const first = customerPhoneHmac(phone)
    process.env.CUSTOMER_PHONE_HMAC_SECRET = "a-different-secret-entirely"

    expect(customerPhoneHmac(phone)).not.toBe(first)
  })

  it("encrypts with a versioned, four-part envelope and a fresh IV each time", () => {
    const first = encryptCustomerPhone(phone)
    const second = encryptCustomerPhone(phone)

    expect(first.split(".")).toHaveLength(4)
    expect(first.startsWith("v1.")).toBe(true)
    // Random IV per call means the same input never yields the same ciphertext.
    expect(first).not.toBe(second)
  })

  it("produces ciphertext that round-trips back to the original number", () => {
    const [, ivPart, tagPart, dataPart] = encryptCustomerPhone(phone).split(".")
    const key = createHash("sha256").update(encryptionKey).digest()
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url")
    )
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8")

    expect(decrypted).toBe(phone)
  })

  it("bundles HMAC, ciphertext, and last four digits together", () => {
    const pii = customerPhonePii(phone)

    expect(pii.phoneHmac).toBe(customerPhoneHmac(phone))
    expect(pii.phoneLast4).toBe("3456")
    expect(pii.phoneCiphertext.startsWith("v1.")).toBe(true)
  })

  it("masks a phone number from its last four digits", () => {
    expect(maskedPhoneFromLast4("3456")).toBe("Phone ending 3456")
    expect(maskedPhoneFromLast4(null)).toBeNull()
  })

  it("refuses to derive identity without the configured secrets", () => {
    delete process.env.CUSTOMER_PHONE_HMAC_SECRET
    expect(() => customerPhoneHmac(phone)).toThrow(
      "CUSTOMER_PHONE_HMAC_SECRET is required"
    )

    delete process.env.CUSTOMER_PHONE_ENCRYPTION_KEY
    expect(() => encryptCustomerPhone(phone)).toThrow(
      "CUSTOMER_PHONE_ENCRYPTION_KEY is required"
    )
  })
})
