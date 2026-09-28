import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS,
  phoneCodeEmailFallbackAt,
  phoneCodeEmailFallbackWaitMs,
} from "@/lib/customer/phone-code-email-fallback"

const SENT_AT = 1_800_000_000

test("email is offered 30 seconds after the server sent the phone code", () => {
  assert.equal(PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS, 30)
  assert.equal(phoneCodeEmailFallbackAt(SENT_AT), SENT_AT + 30)
})

test("the wait runs from the send time, not from when the step appeared", () => {
  const availableAt = phoneCodeEmailFallbackAt(SENT_AT)
  assert.equal(
    phoneCodeEmailFallbackWaitMs(availableAt, SENT_AT * 1_000),
    30_000
  )
  assert.equal(
    phoneCodeEmailFallbackWaitMs(availableAt, SENT_AT * 1_000 + 12_500),
    17_500
  )
  // A reload 40 seconds after the send offers it at once.
  assert.equal(
    phoneCodeEmailFallbackWaitMs(availableAt, (SENT_AT + 40) * 1_000),
    0
  )
  assert.equal(
    phoneCodeEmailFallbackWaitMs(availableAt, (SENT_AT + 30) * 1_000),
    0
  )
})

test("a device clock behind the server's still offers email within the delay", () => {
  const availableAt = phoneCodeEmailFallbackAt(SENT_AT)
  assert.equal(
    phoneCodeEmailFallbackWaitMs(availableAt, (SENT_AT - 600) * 1_000),
    30_000
  )
  assert.equal(phoneCodeEmailFallbackWaitMs(Number.NaN, 0), 30_000)
})
