import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MERCHANT_OTP_RESEND_COOLDOWN_MS,
  MERCHANT_OTP_RESEND_WINDOW_MS,
  MerchantOtpResendRateLimitError,
  enforceMerchantOtpResend,
  merchantOtpResendKeys,
  readMerchantOtpResendCooldown,
  recordInitialSignupOtpCooldown,
} from "@/lib/auth/merchant-otp-resend"
import { RateLimitError } from "@/lib/security/rate-limit"

const input = {
  email: "  Operator@Venue.Test ",
  purpose: "signup",
  requestIdentity: "trusted-request-identity",
}

test("resend keys normalize email and separate signup from recovery", () => {
  const signup = merchantOtpResendKeys(input)
  const recovery = merchantOtpResendKeys({ ...input, purpose: "recovery" })

  assert.match(signup.cooldown, /operator@venue\.test/)
  assert.match(signup.window, /operator@venue\.test/)
  assert.notEqual(signup.cooldown, recovery.cooldown)
  assert.notEqual(signup.window, recovery.window)
  assert.notEqual(signup.cooldown, signup.window)
})

test("a resend enforces a 60-second cooldown and bounded long window", async () => {
  const calls = []
  const retryAt = "2026-07-09T12:01:00.000Z"
  const dependencies = {
    enforceRateLimit: async (config) => calls.push(["enforce", config]),
    peekRateLimit: async (config) => {
      calls.push(["peek", config])
      return {
        used: 1,
        limit: config.limit,
        remaining: 0,
        windowMs: config.windowMs,
        resetAt: retryAt,
      }
    },
  }

  assert.deepEqual(await enforceMerchantOtpResend(input, dependencies), {
    retryAt,
  })
  assert.equal(calls[0][1].limit, 1)
  assert.equal(calls[0][1].windowMs, MERCHANT_OTP_RESEND_COOLDOWN_MS)
  assert.equal(calls[1][1].limit, 5)
  assert.equal(calls[1][1].windowMs, MERCHANT_OTP_RESEND_WINDOW_MS)
  assert.equal(calls[2][0], "peek")
})

test("a blocked resend returns the durable non-sliding reset time", async () => {
  const retryAt = "2026-07-09T12:01:00.000Z"
  const dependencies = {
    enforceRateLimit: async () => {
      throw new RateLimitError()
    },
    peekRateLimit: async ({ limit, windowMs }) => ({
      used: limit,
      limit,
      remaining: 0,
      windowMs,
      resetAt: retryAt,
    }),
  }

  await assert.rejects(
    enforceMerchantOtpResend(input, dependencies),
    (error) =>
      error instanceof MerchantOtpResendRateLimitError &&
      error.retryAt === retryAt
  )
})

test("initial signup records only the cooldown and GET readback preserves it", async () => {
  const calls = []
  const retryAt = "2026-07-09T12:01:00.000Z"
  const dependencies = {
    enforceRateLimit: async (config) => calls.push(config),
    peekRateLimit: async ({ limit, windowMs }) => ({
      used: 1,
      limit,
      remaining: 0,
      windowMs,
      resetAt: retryAt,
    }),
  }

  assert.deepEqual(await recordInitialSignupOtpCooldown(input, dependencies), {
    retryAt,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].limit, 1)
  assert.equal(calls[0].windowMs, MERCHANT_OTP_RESEND_COOLDOWN_MS)
  assert.equal(
    await readMerchantOtpResendCooldown(input, dependencies),
    retryAt
  )
})
