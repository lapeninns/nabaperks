import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"

/**
 * QA BUG-056 (38c42a1..2c45031): a correctly signed customer-session cookie
 * whose sessionId or customerId was not a UUID passed the cookie parser, then
 * failed the Postgres uuid cast inside touch_customer_session_and_load, so
 * /home, /home/profile and even /home/login answered HTTP 500. The proxy also
 * re-signed that cookie for a year on each due renewal, so it never lapsed.
 *
 * The codec now treats such a payload as malformed: no session, a redirect to
 * sign-in, and nothing to renew.
 */

const { createCustomerSessionCookieValue, readCustomerSessionCookieValue } =
  await import("@/lib/customer/session-cookie-core")
const { renewCustomerSessionCookieValue } =
  await import("@/lib/customer/session-renewal-core")

const SECRET = "unit-test-customer-session-secret-0123456789"
const NOW = 1_800_000_000
const YEAR = 365 * 24 * 60 * 60

function payload(overrides = {}) {
  return {
    version: 2,
    sessionId: randomUUID(),
    customerId: randomUUID(),
    issuedAt: NOW - 3 * 24 * 60 * 60,
    expiresAt: NOW + YEAR - 3 * 24 * 60 * 60,
    ...overrides,
  }
}

const MALFORMED_IDS = [
  ["a non-UUID sessionId", { sessionId: "not-a-uuid" }],
  ["an empty sessionId", { sessionId: "" }],
  ["a non-UUID customerId", { customerId: "not-a-uuid" }],
  ["an empty customerId", { customerId: "" }],
  ["a UUID with trailing text", { sessionId: `${randomUUID()}-0` }],
]

test("Given a signed session cookie with UUID ids When it is read Then it is accepted", () => {
  const session = payload()
  const cookie = createCustomerSessionCookieValue(session, SECRET)

  assert.deepEqual(readCustomerSessionCookieValue(cookie, SECRET, NOW), {
    ok: true,
    payload: session,
  })
})

test("Given an upper-case UUID When it is read Then it is accepted, as Postgres accepts it", () => {
  const session = payload({ sessionId: randomUUID().toUpperCase() })
  const cookie = createCustomerSessionCookieValue(session, SECRET)

  assert.equal(readCustomerSessionCookieValue(cookie, SECRET, NOW).ok, true)
})

for (const [label, overrides] of MALFORMED_IDS) {
  test(`Given a correctly signed session cookie with ${label} When it is read Then it is malformed, so no session is resolved`, () => {
    const cookie = createCustomerSessionCookieValue(payload(overrides), SECRET)

    assert.deepEqual(readCustomerSessionCookieValue(cookie, SECRET, NOW), {
      ok: false,
      reason: "malformed",
    })
  })

  test(`Given a correctly signed session cookie with ${label} When its renewal is due Then the proxy has nothing to re-sign`, () => {
    const cookie = createCustomerSessionCookieValue(payload(overrides), SECRET)

    assert.equal(
      renewCustomerSessionCookieValue({
        value: cookie,
        secret: SECRET,
        nowSeconds: NOW,
        ttlSeconds: YEAR,
        renewAfterSeconds: 24 * 60 * 60,
      }),
      null
    )
  })
}
