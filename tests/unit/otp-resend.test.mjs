import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PHONE_CODE_RESEND_AFTER_SECONDS,
  phoneCodeResendAt,
  resendClock,
  resendWaiting,
  sendNewCodeLabel,
} from "@/lib/customer/otp-resend"

test("Given a phone code send time When the resend time is read Then it is the shared wait later, and nothing without a send time", () => {
  assert.equal(PHONE_CODE_RESEND_AFTER_SECONDS, 30)
  assert.equal(
    phoneCodeResendAt(1_800_000_000),
    new Date((1_800_000_000 + 30) * 1_000).toISOString()
  )
  assert.equal(phoneCodeResendAt(undefined), undefined)
  assert.equal(phoneCodeResendAt(null), undefined)
  assert.equal(phoneCodeResendAt(Number.NaN), undefined)
})

test("Given seconds left When shown Then they read as a quiet m:ss clock", () => {
  assert.equal(resendClock(24), "0:24")
  assert.equal(resendClock(23.2), "0:24")
  assert.equal(resendClock(90), "1:30")
  assert.equal(resendClock(-3), "0:00")
})

test("Given the countdown When the client clock runs Then the label counts down; before it runs the control stays usable", () => {
  const running = { active: true, ready: true, remainingSeconds: 24 }
  assert.equal(sendNewCodeLabel(running), "Send a new code in 0:24")
  assert.equal(resendWaiting(running), true)

  const beforeHydration = { active: true, ready: false, remainingSeconds: 0 }
  assert.equal(sendNewCodeLabel(beforeHydration), "Send a new code")
  assert.equal(resendWaiting(beforeHydration), false)

  const done = { active: false, ready: true, remainingSeconds: 0 }
  assert.equal(sendNewCodeLabel(done), "Send a new code")
  assert.equal(resendWaiting(done), false)
})
