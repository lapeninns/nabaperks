import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MERCHANT_OTP_OUTCOMES,
  merchantOtpFocusTarget,
  merchantOtpRetryCountdown,
  normalizeMerchantOtpRetryAt,
} from "@/lib/auth/merchant-auth-action-state"

test("merchant OTP outcomes are closed and stable", () => {
  assert.deepEqual(MERCHANT_OTP_OUTCOMES, [
    "idle",
    "invalid",
    "expired",
    "used",
    "superseded",
    "busy",
    "throttled",
    "verification_unavailable",
    "delivery_unavailable",
    "sent",
    "verification_required",
    "password_update_failed",
  ])
})

test("only an editable invalid code sends focus back to the OTP field", () => {
  assert.equal(merchantOtpFocusTarget("invalid"), "otp")

  for (const outcome of [
    "expired",
    "used",
    "superseded",
    "busy",
    "throttled",
    "delivery_unavailable",
    "password_update_failed",
  ]) {
    assert.equal(merchantOtpFocusTarget(outcome), "recovery", outcome)
  }

  assert.equal(merchantOtpFocusTarget("verification_unavailable"), null)
  assert.equal(merchantOtpFocusTarget("sent"), "otp")
  assert.equal(merchantOtpFocusTarget("idle"), null)
})

test("retry countdowns ceil partial seconds and never go below zero", () => {
  const now = Date.parse("2026-07-09T12:00:00.000Z")

  assert.deepEqual(merchantOtpRetryCountdown("2026-07-09T12:01:00.000Z", now), {
    active: true,
    remainingSeconds: 60,
  })
  assert.deepEqual(merchantOtpRetryCountdown("2026-07-09T12:00:00.001Z", now), {
    active: true,
    remainingSeconds: 1,
  })
  assert.deepEqual(merchantOtpRetryCountdown("2026-07-09T11:59:59.999Z", now), {
    active: false,
    remainingSeconds: 0,
  })
  assert.deepEqual(merchantOtpRetryCountdown("not-a-date", now), {
    active: false,
    remainingSeconds: 0,
  })
})

test("untrusted retry timestamps must be valid, future, and bounded", () => {
  const now = Date.parse("2026-07-09T12:00:00.000Z")

  assert.equal(
    normalizeMerchantOtpRetryAt("2026-07-09T12:01:00.000Z", now),
    "2026-07-09T12:01:00.000Z"
  )
  assert.equal(normalizeMerchantOtpRetryAt("not-a-date", now), undefined)
  assert.equal(
    normalizeMerchantOtpRetryAt("2026-07-09T11:59:59.999Z", now),
    undefined
  )
  assert.equal(
    normalizeMerchantOtpRetryAt("2026-07-09T12:30:00.000Z", now),
    undefined,
    "a forged far-future value cannot disable recovery indefinitely"
  )
})
