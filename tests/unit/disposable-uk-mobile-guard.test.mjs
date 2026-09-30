import assert from "node:assert/strict"
import { test } from "node:test"

import { disposableUkMobile } from "../e2e/helpers/customer-join-live-db.ts"

/**
 * QA BUG-052: live-DB specs type random real-range UK mobiles (the app rejects
 * the drama range), so the generator must refuse unless nothing could text
 * them: local development, a loopback app on the dev-code path, and only the
 * repository's synthetic Twilio placeholders.
 */

// The hosted CI fixture (.github/workflows/ci.yml top-level env).
const SYNTHETIC_ENV = {
  NODE_ENV: "test",
  CUSTOMER_DEV_OTP_CODE: "424242",
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3146",
  TWILIO_ACCOUNT_SID: "ACci",
  TWILIO_AUTH_TOKEN: "ci-twilio-auth-token",
  TWILIO_VERIFY_SERVICE_SID: "VAci",
  TWILIO_MESSAGING_SERVICE_SID: "",
}

// A provider-enabled environment: Twilio credentials that are not the known
// synthetic placeholders.
const LIVE_PROVIDER_ENV = {
  ...SYNTHETIC_ENV,
  TWILIO_ACCOUNT_SID: `AC${"1f".repeat(16)}`,
  TWILIO_AUTH_TOKEN: "2e".repeat(16),
  TWILIO_VERIFY_SERVICE_SID: `VA${"3d".repeat(16)}`,
}

test("a real-range test mobile is refused when the provider could text it", () => {
  assert.throws(() => disposableUkMobile(LIVE_PROVIDER_ENV), /Twilio/)
  assert.throws(
    () =>
      disposableUkMobile({
        ...SYNTHETIC_ENV,
        TWILIO_MESSAGING_SERVICE_SID: `MG${"4c".repeat(16)}`,
      }),
    /TWILIO_MESSAGING_SERVICE_SID/
  )
})

test("the refusal names the settings, never their values", () => {
  let message = ""
  try {
    disposableUkMobile(LIVE_PROVIDER_ENV)
  } catch (error) {
    message = String(error.message)
  }
  assert.match(message, /TWILIO_ACCOUNT_SID/)
  assert.doesNotMatch(message, /1f1f|2e2e|3d3d/)
})

test("a real-range test mobile is refused outside local development", () => {
  assert.throws(
    () => disposableUkMobile({ ...SYNTHETIC_ENV, NODE_ENV: "production" }),
    /local development/
  )
  assert.throws(
    () => disposableUkMobile({ ...SYNTHETIC_ENV, VERCEL_ENV: "preview" }),
    /local development/
  )
})

test("a real-range test mobile is refused against a non-loopback app", () => {
  assert.throws(
    () =>
      disposableUkMobile({
        ...SYNTHETIC_ENV,
        PLAYWRIGHT_BASE_URL: "https://staging.example.test",
      }),
    /loopback/
  )
})

test("a reused server must be on the dev-code path", () => {
  assert.throws(
    () =>
      disposableUkMobile({
        ...SYNTHETIC_ENV,
        CUSTOMER_DEV_OTP_CODE: "",
        PLAYWRIGHT_REUSE_EXISTING_SERVER: "1",
      }),
    /CUSTOMER_DEV_OTP_CODE/
  )
})

test("synthetic placeholders or no Twilio settings allow a valid GB mobile", () => {
  const phone = disposableUkMobile(SYNTHETIC_ENV)
  assert.match(phone.e164, /^\+447\d{9}$/)
  assert.equal(phone.last4, phone.e164.slice(-4))

  const bare = disposableUkMobile({
    NODE_ENV: "test",
    PLAYWRIGHT_BASE_URL: "http://localhost:3310",
  })
  assert.match(bare.e164, /^\+447\d{9}$/)
})
