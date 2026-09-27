import assert from "node:assert/strict"
import { test } from "node:test"

const { createCustomerSessionCookieValue, readCustomerSessionCookieValue } =
  await import("@/lib/customer/session-cookie-core")
const { renewCustomerSessionCookieValue } =
  await import("@/lib/customer/session-renewal-core")

const SECRET = "unit-test-customer-session-secret"
const DAY = 24 * 60 * 60
const TTL = 365 * DAY
const NOW = 2_000_000_000

function sessionCookie(overrides = {}) {
  const payload = {
    version: 2,
    sessionId: "3f0c5f7e-2d3b-4c1a-9a57-5f2f1f8f9a10",
    customerId: "9b8f7e6d-5c4b-4a39-8281-716151413121",
    issuedAt: NOW - 20 * DAY,
    expiresAt: NOW + 10 * DAY,
    ...overrides,
  }
  return { payload, value: createCustomerSessionCookieValue(payload, SECRET) }
}

function renew(value, nowSeconds = NOW, secret = SECRET) {
  return renewCustomerSessionCookieValue({
    value,
    secret,
    nowSeconds,
    ttlSeconds: TTL,
    renewAfterSeconds: DAY,
  })
}

test("Given a pre-change 30-day session cookie When the customer visits Then it is re-signed for the full rolling window with the same identity", () => {
  const { payload, value } = sessionCookie()

  const renewed = renew(value)

  assert.ok(renewed, "a legacy 30-day cookie is renewed on the first visit")
  const read = readCustomerSessionCookieValue(renewed, SECRET, NOW)
  assert.equal(read.ok, true)
  assert.deepEqual(read.payload, { ...payload, expiresAt: NOW + TTL })
})

test("Given a renewed cookie When it is presented again within a day Then it is not re-signed", () => {
  const { value } = sessionCookie({ expiresAt: NOW + TTL })

  assert.equal(renew(value, NOW + DAY - 1), null)
  assert.ok(renew(value, NOW + DAY), "renewal is due exactly one day later")
})

test("Given the renewed signature When it is read far beyond the old 30-day window Then it remains valid until the rolling expiry", () => {
  const { value } = sessionCookie()
  const renewed = renew(value)

  assert.equal(
    readCustomerSessionCookieValue(renewed, SECRET, NOW + 300 * DAY).ok,
    true
  )
  assert.equal(
    readCustomerSessionCookieValue(renewed, SECRET, NOW + TTL).ok,
    false,
    "the signed expiry still binds; a cookie is never stretched past it"
  )
})

test("Given an expired, forged, or missing session cookie When the proxy runs Then nothing is renewed", () => {
  const expired = sessionCookie({ expiresAt: NOW }).value
  const forged = sessionCookie().value

  assert.equal(renew(expired), null, "an expired cookie stays expired")
  assert.equal(renew(forged, NOW, "another-customer-session-secret"), null)
  const [body, signature] = forged.split(".")
  const tampered = `${body}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`
  assert.equal(renew(tampered), null, "a tampered signature is rejected")
  assert.equal(renew(undefined), null)
  assert.equal(
    renewCustomerSessionCookieValue({
      value: sessionCookie().value,
      secret: undefined,
      nowSeconds: NOW,
      ttlSeconds: TTL,
      renewAfterSeconds: DAY,
    }),
    null,
    "no secret configured means no renewal"
  )
})
