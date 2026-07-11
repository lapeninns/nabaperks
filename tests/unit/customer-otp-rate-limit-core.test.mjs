import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerOtpSendIdentityRateLimitKey,
  customerOtpSendIpRateLimitKey,
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
    customerOtpSendIdentityRateLimitKey("first-browser"),
    customerOtpSendIdentityRateLimitKey("second-browser")
  )
})

test("Given device cookies rotate behind one trusted IP When send buckets are built Then the network ceiling stays stable", () => {
  assert.equal(
    customerOtpSendIpRateLimitKey("203.0.113.7"),
    customerOtpSendIpRateLimitKey("203.0.113.7")
  )
})

test("Given one identity rotates phone numbers When send buckets are built Then every phone shares the identity ceiling", () => {
  assert.equal(
    customerOtpSendIdentityRateLimitKey("same-browser"),
    customerOtpSendIdentityRateLimitKey("same-browser")
  )
})

test("Given verification guesses for one phone from different identities When buckets are built Then the phone bucket is stable", () => {
  const phone = "+447700900123"

  assert.equal(
    customerOtpVerifyPhoneRateLimitKey(phone),
    customerOtpVerifyPhoneRateLimitKey(phone)
  )
  assert.notEqual(
    customerOtpVerifyIdentityRateLimitKey("first-browser"),
    customerOtpVerifyIdentityRateLimitKey("second-browser")
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
