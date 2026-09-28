import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS,
  emailFallbackOpen,
  phoneCodeEmailFallbackInSeconds,
  phoneCodeEmailFallbackWaitMs,
  phoneCodeStepTiming,
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

test("the server opens email only 30 seconds after the latest phone code, a failed send or no cards, or an email already under way", () => {
  const at = (seconds) => (SENT_AT + seconds) * 1_000
  // No phone code and nothing opened: a bookmarked `step=email` gets phone.
  assert.equal(emailFallbackOpen({}, at(0)), false)
  assert.equal(emailFallbackOpen({ phoneCodeSentAt: null }, at(60)), false)
  // The latest code's wait, by the server's clock.
  assert.equal(emailFallbackOpen({ phoneCodeSentAt: SENT_AT }, at(0)), false)
  assert.equal(emailFallbackOpen({ phoneCodeSentAt: SENT_AT }, at(29)), false)
  assert.equal(emailFallbackOpen({ phoneCodeSentAt: SENT_AT }, at(30)), true)
  // A resend at +20 moves the wait to +50.
  assert.equal(
    emailFallbackOpen({ phoneCodeSentAt: SENT_AT + 20 }, at(35)),
    false
  )
  assert.equal(
    emailFallbackOpen({ phoneCodeSentAt: SENT_AT + 20 }, at(50)),
    true
  )
  assert.equal(
    emailFallbackOpen({ phoneCodeSentAt: Number.NaN }, at(60)),
    false
  )
  // A failed send or no cards opened it; an email sign-in keeps it open.
  assert.equal(emailFallbackOpen({ opened: true }, at(0)), true)
  assert.equal(
    emailFallbackOpen({ phoneCodeSentAt: SENT_AT, opened: true }, at(1)),
    true
  )
  assert.equal(emailFallbackOpen({ emailInProgress: true }, at(0)), true)
})

test("a code step's timing carries the send time, so a resend restarts the wait", () => {
  assert.deepEqual(phoneCodeStepTiming(SENT_AT, (SENT_AT + 12) * 1_000), {
    phoneCodeSentAt: SENT_AT,
    emailFallbackInSeconds: 18,
  })
  assert.deepEqual(phoneCodeStepTiming(SENT_AT + 12, (SENT_AT + 12) * 1_000), {
    phoneCodeSentAt: SENT_AT + 12,
    emailFallbackInSeconds: 30,
  })
})
