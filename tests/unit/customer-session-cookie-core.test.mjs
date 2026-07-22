import assert from "node:assert/strict"
import { test } from "node:test"

const {
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readPendingEmailCookieValue,
  readPendingPhoneCookieValue,
} = await import("@/lib/customer/session-cookie-core")

const SECRET = "unit-test-customer-session-secret"

test("Given a pending phone cookie When it is read before expiry Then the payload is accepted", () => {
  const payload = {
    version: 2,
    purpose: "join",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingPhoneCookieValue(payload, SECRET)

  const result = readPendingPhoneCookieValue(cookie, SECRET, 699)

  assert.deepEqual(result, { ok: true, payload })
})

test("Given a pending phone cookie When it is read at expiry Then it is rejected", () => {
  const payload = {
    version: 2,
    purpose: "join",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingPhoneCookieValue(payload, SECRET)

  const result = readPendingPhoneCookieValue(cookie, SECRET, 700)

  assert.deepEqual(result, { ok: false, reason: "expired" })
})

test("Given pending contact state When it is written Then its plaintext and base64 encoding are absent", () => {
  const payload = {
    version: 2,
    purpose: "join",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    issuedAt: 100,
    expiresAt: 700,
  }

  const cookie = createPendingPhoneCookieValue(payload, SECRET)

  assert.ok(!cookie.includes(payload.phone))
  assert.ok(
    !Buffer.from(cookie.split(".")[0] ?? "", "base64url")
      .toString("utf8")
      .includes(payload.phone)
  )
})

test("Given the same pending phone state When it is written twice Then fresh nonces produce distinct values", () => {
  const payload = {
    version: 2,
    purpose: "join",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    issuedAt: 100,
    expiresAt: 700,
  }

  const first = createPendingPhoneCookieValue(payload, SECRET)
  const second = createPendingPhoneCookieValue(payload, SECRET)

  assert.notEqual(first, second)
})

test("Given an encrypted phone cookie When the email context reads it Then it is rejected", () => {
  const payload = {
    version: 2,
    purpose: "wallet",
    phone: "+447700900123",
    phoneHmac: "phone-hmac",
    country: "GB",
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingPhoneCookieValue(payload, SECRET)

  const result = readPendingEmailCookieValue(cookie, SECRET, 699)

  assert.equal(result.ok, false)
})

test("Given an encrypted email cookie When its correct context reads it Then it round-trips", () => {
  const payload = {
    version: 1,
    email: "guest@example.com",
    codeHmac: "code-hmac",
    customerId: null,
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingEmailCookieValue(payload, SECRET)

  const result = readPendingEmailCookieValue(cookie, SECRET, 699)

  assert.deepEqual(result, { ok: true, payload })
})
