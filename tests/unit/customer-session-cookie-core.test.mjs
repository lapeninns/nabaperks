import assert from "node:assert/strict"
import { test } from "node:test"

const {
  createPendingPhoneCookieValue,
  readPendingPhoneCookieValue,
} = await import("@/lib/customer/session-cookie-core")

const SECRET = "unit-test-customer-session-secret"

test("Given a pending phone cookie When it is read before expiry Then the payload is accepted", () => {
  const payload = {
    version: 1,
    purpose: "join",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    customerId: null,
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingPhoneCookieValue(payload, SECRET)

  const result = readPendingPhoneCookieValue(cookie, SECRET, 699)

  assert.deepEqual(result, { ok: true, payload })
})

test("Given a pending phone cookie When it is read at expiry Then it is rejected", () => {
  const payload = {
    version: 1,
    purpose: "join",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    customerId: null,
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingPhoneCookieValue(payload, SECRET)

  const result = readPendingPhoneCookieValue(cookie, SECRET, 700)

  assert.deepEqual(result, { ok: false, reason: "expired" })
})
