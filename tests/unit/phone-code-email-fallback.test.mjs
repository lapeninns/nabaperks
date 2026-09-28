import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS,
  phoneCodeEmailFallbackInSeconds,
  phoneCodeEmailFallbackWaitMs,
} from "@/lib/customer/phone-code-email-fallback"

const SENT_AT = 1_800_000_000

test("the server works out the seconds left from its own send time and clock", () => {
  assert.equal(PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS, 30)
  assert.equal(phoneCodeEmailFallbackInSeconds(SENT_AT, SENT_AT * 1_000), 30)
  assert.equal(
    phoneCodeEmailFallbackInSeconds(SENT_AT, SENT_AT * 1_000 + 12_500),
    18,
    "part of a second left still waits for it"
  )
  // A reload 40 seconds after the send offers it at once.
  assert.equal(
    phoneCodeEmailFallbackInSeconds(SENT_AT, (SENT_AT + 40) * 1_000),
    0
  )
  assert.equal(
    phoneCodeEmailFallbackInSeconds(SENT_AT, (SENT_AT + 30) * 1_000),
    0
  )
  // Never more than the delay, whatever the send time says.
  assert.equal(
    phoneCodeEmailFallbackInSeconds(SENT_AT + 600, SENT_AT * 1_000),
    30
  )
  assert.equal(phoneCodeEmailFallbackInSeconds(Number.NaN, 0), 30)
})

test("the step counts the server's seconds down from when it appears, never from the device clock", () => {
  assert.equal(phoneCodeEmailFallbackWaitMs(30), 30_000)
  assert.equal(phoneCodeEmailFallbackWaitMs(18), 18_000)
  assert.equal(phoneCodeEmailFallbackWaitMs(0), 0)
  // Anything unusable waits the full delay rather than offering email early.
  assert.equal(phoneCodeEmailFallbackWaitMs(-5), 0)
  assert.equal(phoneCodeEmailFallbackWaitMs(900), 30_000)
  assert.equal(phoneCodeEmailFallbackWaitMs(Number.NaN), 30_000)
  assert.equal(phoneCodeEmailFallbackWaitMs(Number.POSITIVE_INFINITY), 30_000)
})
