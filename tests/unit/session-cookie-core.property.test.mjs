import assert from "node:assert/strict"
import { test } from "node:test"

import fc from "fast-check"

const {
  createCustomerSessionCookieValue,
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readCustomerSessionCookieValue,
  readPendingEmailCookieValue,
  readPendingPhoneCookieValue,
} = await import("@/lib/customer/session-cookie-core")

const secretArbitrary = fc
  .string({ minLength: 12, maxLength: 80 })
  .filter((value) => value.trim().length > 0)
const timestampArbitrary = fc.integer({ min: 1_000, max: 2_000_000 })
const phoneArbitrary = fc
  .integer({ min: 0, max: 999_999_999 })
  .map((value) => `+4477${String(value).padStart(9, "0")}`)

const pendingPhonePayloadArbitrary = timestampArbitrary.chain((issuedAt) =>
  fc
    .record({
      version: fc.constant(1),
      purpose: fc.constantFrom("join", "wallet"),
      phone: phoneArbitrary,
      phoneHmac: fc.string({ minLength: 1, maxLength: 80 }),
      country: fc.constant("GB"),
      customerId: fc.option(fc.uuid(), { nil: null }),
      issuedAt: fc.constant(issuedAt),
      expiresAt: fc.integer({ min: issuedAt + 1, max: issuedAt + 86_400 }),
    })
    .map((payload) => ({ ...payload }))
)

const pendingEmailPayloadArbitrary = timestampArbitrary.chain((issuedAt) =>
  fc
    .record({
      version: fc.constant(1),
      email: fc.emailAddress(),
      codeHmac: fc.string({ minLength: 1, maxLength: 80 }),
      customerId: fc.option(fc.uuid(), { nil: null }),
      issuedAt: fc.constant(issuedAt),
      expiresAt: fc.integer({ min: issuedAt + 1, max: issuedAt + 86_400 }),
    })
    .map((payload) => ({ ...payload }))
)

const customerSessionPayloadArbitrary = timestampArbitrary.chain((issuedAt) =>
  fc
    .record({
      version: fc.constant(2),
      sessionId: fc.uuid(),
      customerId: fc.uuid(),
      issuedAt: fc.constant(issuedAt),
      expiresAt: fc.integer({ min: issuedAt + 1, max: issuedAt + 86_400 }),
    })
    .map((payload) => ({ ...payload }))
)

test("Given arbitrary pending phone payloads When signed Then they read back before expiry", () => {
  fc.assert(
    fc.property(
      pendingPhonePayloadArbitrary,
      secretArbitrary,
      (payload, secret) => {
        const cookie = createPendingPhoneCookieValue(payload, secret)
        const result = readPendingPhoneCookieValue(
          cookie,
          secret,
          payload.expiresAt - 1
        )

        assert.deepEqual(result, { ok: true, payload })
      }
    ),
    { numRuns: 100 }
  )
})

test("Given arbitrary pending email payloads When signed Then they read back before expiry", () => {
  fc.assert(
    fc.property(
      pendingEmailPayloadArbitrary,
      secretArbitrary,
      (payload, secret) => {
        const cookie = createPendingEmailCookieValue(payload, secret)
        const result = readPendingEmailCookieValue(
          cookie,
          secret,
          payload.expiresAt - 1
        )

        assert.deepEqual(result, { ok: true, payload })
      }
    ),
    { numRuns: 100 }
  )
})

test("Given arbitrary customer session payloads When signed Then they read back before expiry", () => {
  fc.assert(
    fc.property(
      customerSessionPayloadArbitrary,
      secretArbitrary,
      (payload, secret) => {
        const cookie = createCustomerSessionCookieValue(payload, secret)
        const result = readCustomerSessionCookieValue(
          cookie,
          secret,
          payload.expiresAt - 1
        )

        assert.deepEqual(result, { ok: true, payload })
      }
    ),
    { numRuns: 100 }
  )
})

test("Given signed pending phone cookies When the signature is changed Then verification fails", () => {
  fc.assert(
    fc.property(
      pendingPhonePayloadArbitrary,
      secretArbitrary,
      (payload, secret) => {
        const cookie = createPendingPhoneCookieValue(payload, secret)
        const tampered = tamperSignature(cookie)

        assert.deepEqual(
          readPendingPhoneCookieValue(tampered, secret, payload.expiresAt - 1),
          {
            ok: false,
            reason: "invalid_signature",
          }
        )
      }
    ),
    { numRuns: 100 }
  )
})

function tamperSignature(cookie) {
  const [body, signature] = cookie.split(".")
  const replacement =
    signature === "A".repeat(signature.length)
      ? "B".repeat(signature.length)
      : "A".repeat(signature.length)

  return `${body}.${replacement}`
}
