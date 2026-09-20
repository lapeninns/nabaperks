import assert from "node:assert/strict"
import { test } from "node:test"

import customerMessagingContentEvents from "@/config/customer-messaging-content-events.json" with { type: "json" }
import { assertValidEnv, EnvConfigError } from "@/lib/env/validate"

const completeContentSidMap = Object.fromEntries(
  customerMessagingContentEvents.map((eventType, index) => [
    eventType,
    `HX${index.toString(16).padStart(32, "0")}`,
  ])
)

test("customer messaging defaults off and rejects unknown modes", () => {
  assert.doesNotThrow(() => assertValidEnv([], {}))
  assert.throws(
    () => assertValidEnv([], { CUSTOMER_MESSAGING_MODE: "enabled" }),
    (error) =>
      error instanceof EnvConfigError &&
      error.invalid.includes(
        "CUSTOMER_MESSAGING_MODE must be off, dry_run or live"
      )
  )
})

test("dry-run and live modes require the complete Twilio template configuration", () => {
  assert.throws(
    () => assertValidEnv([], { CUSTOMER_MESSAGING_MODE: "dry_run" }),
    (error) =>
      error instanceof EnvConfigError &&
      error.invalid.some((message) =>
        message.startsWith("TWILIO_AUTH_TOKEN")
      ) &&
      error.invalid.some((message) => message.startsWith("TWILIO_CONTENT_SIDS"))
  )

  assert.doesNotThrow(() =>
    assertValidEnv([], {
      CUSTOMER_MESSAGING_MODE: "live",
      TWILIO_AUTH_TOKEN: "fixture-token",
      TWILIO_ACCOUNT_SID: `AC${"1".repeat(32)}`,
      TWILIO_CUSTOMER_MESSAGING_SERVICE_SID: `MG${"2".repeat(32)}`,
      TWILIO_CONTENT_SIDS: JSON.stringify(completeContentSidMap),
    })
  )

  assert.throws(
    () =>
      assertValidEnv([], {
        CUSTOMER_MESSAGING_MODE: "live",
        TWILIO_AUTH_TOKEN: "fixture-token",
        TWILIO_ACCOUNT_SID: `AC${"1".repeat(32)}`,
        TWILIO_CUSTOMER_MESSAGING_SERVICE_SID: `MG${"2".repeat(32)}`,
        TWILIO_CONTENT_SIDS: JSON.stringify({
          reward_ready: `HX${"3".repeat(32)}`,
        }),
      }),
    /missing approved templates/
  )
})

test("the local messaging bypass accepts only log", () => {
  assert.doesNotThrow(() =>
    assertValidEnv([], { CUSTOMER_MESSAGING_BYPASS_MODE: "log" })
  )
  assert.throws(
    () => assertValidEnv([], { CUSTOMER_MESSAGING_BYPASS_MODE: "send" }),
    /CUSTOMER_MESSAGING_BYPASS_MODE must be log or blank/
  )
})

test("template mappings fail closed on malformed values", () => {
  assert.throws(
    () => assertValidEnv([], { TWILIO_CONTENT_SIDS: '{"reward_ready":"bad"}' }),
    /TWILIO_CONTENT_SIDS must be a JSON object of HX Content SIDs/
  )
})
