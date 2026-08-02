import assert from "node:assert/strict"
import { test } from "node:test"

import {
  customerOtpSendIdentityRateLimitKey,
  customerOtpSendIpRateLimitKey,
  customerOtpSendPhoneRateLimitKey,
  customerOtpVerifyIdentityRateLimitKey,
  customerOtpVerifyPhoneRateLimitKey,
  customerOtpDispatchBurstLimit,
  customerOtpDispatchBurstRateLimitKey,
  customerOtpDispatchBurstWindowMs,
  customerOtpDispatchSustainedLimit,
  customerOtpDispatchSustainedRateLimitKey,
  customerOtpDispatchSustainedWindowMs,
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

test("the dispatch budget key cannot be rotated by the caller", () => {
  // Every other OTP bucket is keyed on a subject the sender controls — phone,
  // device hash, source IP — so a distributed sender just varies them. The
  // dispatch scope comes from a closed set the server action picks, so there is
  // nothing for an attacker to vary.
  assert.equal(
    customerOtpDispatchBurstRateLimitKey("wallet"),
    "customer-otp:send:dispatch-budget:wallet:burst"
  )
  assert.equal(
    customerOtpDispatchSustainedRateLimitKey("wallet"),
    "customer-otp:send:dispatch-budget:wallet:sustained"
  )

  // Two different senders hitting the same entry point share one budget.
  assert.equal(
    customerOtpDispatchBurstRateLimitKey("wallet"),
    customerOtpDispatchBurstRateLimitKey("wallet")
  )

  // The two entry points are budgeted separately, so saturating the public
  // wallet login cannot deny in-venue joining.
  assert.notEqual(
    customerOtpDispatchBurstRateLimitKey("wallet"),
    customerOtpDispatchBurstRateLimitKey("join")
  )

  // Burst and sustained are distinct buckets, not one key with two limits.
  assert.notEqual(
    customerOtpDispatchBurstRateLimitKey("join"),
    customerOtpDispatchSustainedRateLimitKey("join")
  )
})

test("the dispatch budget self-heals within an hour", () => {
  // A saturated platform budget degrades sign-in for everyone, so it must
  // recover without an operator. An hour bounds the blast radius of a
  // successful exhaustion attempt.
  assert.equal(customerOtpDispatchBurstWindowMs, 60_000)
  assert.equal(customerOtpDispatchSustainedWindowMs, 60 * 60_000)
  assert.ok(customerOtpDispatchBurstLimit < customerOtpDispatchSustainedLimit)
})
