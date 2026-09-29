import assert from "node:assert/strict"
import { test } from "node:test"

const { createCustomerSessionCookieValue } =
  await import("@/lib/customer/session-cookie-core")
const { confirmCustomerSessionRenewal, renewCustomerSessionCookieValue } =
  await import("@/lib/customer/session-renewal-core")

/**
 * QA BUG-009 (38c42a1..2c45031): a due renewal is set only when the database
 * still accepts the session. The HTTP proof is
 * tests/e2e/customer-session-renewal-live-db.spec.ts.
 */

const SECRET = "unit-test-customer-session-secret"
const DAY = 24 * 60 * 60
const TTL = 365 * DAY
const NOW = 2_000_000_000
const SESSION = {
  version: 2,
  sessionId: "3f0c5f7e-2d3b-4c1a-9a57-5f2f1f8f9a10",
  customerId: "9b8f7e6d-5c4b-4a39-8281-716151413121",
  issuedAt: NOW - 3 * DAY,
  expiresAt: NOW - 3 * DAY + TTL,
}

function dueRenewal() {
  const renewed = renewCustomerSessionCookieValue({
    value: createCustomerSessionCookieValue(SESSION, SECRET),
    secret: SECRET,
    nowSeconds: NOW,
    ttlSeconds: TTL,
    renewAfterSeconds: DAY,
  })
  assert.ok(renewed, "precondition: the renewal is due")
  return renewed
}

function confirm(renewed, isSessionActive) {
  return confirmCustomerSessionRenewal({
    renewed,
    secret: SECRET,
    nowSeconds: NOW,
    isSessionActive,
  })
}

test("Given the database still accepts the session When a renewal is due Then the re-signed cookie is set, asked about that session only", async () => {
  const renewed = dueRenewal()
  const asked = []

  const result = await confirm(renewed, async (session) => {
    asked.push({ customerId: session.customerId, sessionId: session.sessionId })
    return true
  })

  assert.equal(result, renewed)
  assert.deepEqual(asked, [
    { customerId: SESSION.customerId, sessionId: SESSION.sessionId },
  ])
})

test("Given the session was revoked, expired or deleted server-side When a renewal is due Then nothing is re-signed", async () => {
  assert.equal(await confirm(dueRenewal(), async () => false), null)
})

test("Given the database cannot answer When a renewal is due Then nothing is renewed and the current cookie stands", async () => {
  const result = await confirm(dueRenewal(), async () => {
    throw new Error("database unavailable")
  })

  assert.equal(result, null)
})

test("Given no due renewal or a forged value When confirming Then the database is never asked", async () => {
  let asked = 0
  const isSessionActive = async () => {
    asked += 1
    return true
  }

  assert.equal(await confirm(null, isSessionActive), null)
  assert.equal(await confirm(`${dueRenewal()}x`, isSessionActive), null)
  assert.equal(
    await confirmCustomerSessionRenewal({
      renewed: dueRenewal(),
      secret: undefined,
      nowSeconds: NOW,
      isSessionActive,
    }),
    null
  )
  assert.equal(asked, 0)
})
