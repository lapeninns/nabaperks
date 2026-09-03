import assert from "node:assert/strict"
import { test } from "node:test"

const {
  createPendingAccessRecoveryCookieValue,
  createPendingEmailCookieValue,
  createPendingPhoneCookieValue,
  readPendingAccessRecoveryCookieValue,
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

test("access recovery state is encrypted and bound to its dedicated context", () => {
  const payload = {
    version: 1,
    sessionId: "session-id",
    customerId: "customer-id",
    phoneHmac: "a".repeat(64),
    deviceHash: "b".repeat(64),
    emailHmac: "c".repeat(64),
    codeHmac: "d".repeat(64),
    next: "/m/venue/join?step=terms",
    issuedAt: 100,
    expiresAt: 700,
  }
  const cookie = createPendingAccessRecoveryCookieValue(payload, SECRET)

  assert.ok(!cookie.includes(payload.customerId))
  assert.deepEqual(readPendingAccessRecoveryCookieValue(cookie, SECRET, 699), {
    ok: true,
    payload,
  })
  assert.equal(readPendingEmailCookieValue(cookie, SECRET, 699).ok, false)
})

test("access recovery rejects an external redirect and tampered device binding", () => {
  const payload = {
    version: 1,
    sessionId: "session-id",
    customerId: "customer-id",
    phoneHmac: "a".repeat(64),
    deviceHash: "b".repeat(64),
    emailHmac: "c".repeat(64),
    codeHmac: "d".repeat(64),
    next: "//attacker.example",
    issuedAt: 100,
    expiresAt: 700,
  }
  const invalidNext = createPendingAccessRecoveryCookieValue(payload, SECRET)
  assert.deepEqual(
    readPendingAccessRecoveryCookieValue(invalidNext, SECRET, 699),
    { ok: false, reason: "malformed" }
  )

  const valid = createPendingAccessRecoveryCookieValue(
    { ...payload, next: "/home", deviceHash: "e".repeat(64) },
    SECRET
  )
  const parts = valid.split(".")
  const ciphertext = Buffer.from(parts[2], "base64url")
  ciphertext[0] ^= 1
  parts[2] = ciphertext.toString("base64url")
  assert.equal(
    readPendingAccessRecoveryCookieValue(parts.join("."), SECRET, 699).ok,
    false
  )
})
