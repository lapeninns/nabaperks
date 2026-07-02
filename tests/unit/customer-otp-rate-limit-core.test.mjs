import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerOtpSendIdentityRateLimitKey,
  customerOtpSendPhoneRateLimitKey,
  customerOtpVerifyIdentityRateLimitKey,
  customerOtpVerifyPhoneRateLimitKey,
} from "@/lib/customer/otp-rate-limit-core"

test("Given send requests for one phone from different identities When buckets are built Then the phone bucket is stable", () => {
  const phone = "+447700900123"

  assert.equal(
    customerOtpSendPhoneRateLimitKey(phone),
    customerOtpSendPhoneRateLimitKey(phone)
  )
  assert.notEqual(
    customerOtpSendIdentityRateLimitKey(phone, "first-browser"),
    customerOtpSendIdentityRateLimitKey(phone, "second-browser")
  )
})

test("Given verification guesses for one phone from different identities When buckets are built Then the phone bucket is stable", () => {
  const phone = "+447700900123"

  assert.equal(
    customerOtpVerifyPhoneRateLimitKey(phone),
    customerOtpVerifyPhoneRateLimitKey(phone)
  )
  assert.notEqual(
    customerOtpVerifyIdentityRateLimitKey(phone, "first-browser"),
    customerOtpVerifyIdentityRateLimitKey(phone, "second-browser")
  )
})

test("Given equivalent phones with different casing When buckets are built Then rate limits share one canonical key", () => {
  assert.equal(
    customerOtpSendPhoneRateLimitKey("CUSTOMER@example.test"),
    customerOtpSendPhoneRateLimitKey("customer@example.test")
  )
  assert.equal(
    customerOtpVerifyPhoneRateLimitKey("CUSTOMER@example.test"),
    customerOtpVerifyPhoneRateLimitKey("customer@example.test")
  )
})
