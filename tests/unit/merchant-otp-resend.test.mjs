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
  const enforcedKeys = new Set()
  const retryAt = "2026-07-09T12:01:00.000Z"
  const dependencies = {
    enforceRateLimit: async (config) => {
      calls.push(["enforce", config])
      enforcedKeys.add(config.key)
    },
    peekRateLimit: async (config) => {
      calls.push(["peek", config])
      const exhausted = enforcedKeys.has(config.key) && config.limit === 1
      return {
        used: exhausted ? config.limit : 0,
        limit: config.limit,
        remaining: exhausted ? 0 : config.limit,
        windowMs: config.windowMs,
        resetAt: exhausted ? retryAt : null,
      }
    },
  }

  assert.deepEqual(await enforceMerchantOtpResend(input, dependencies), {
    retryAt,
  })
  const enforced = calls
    .filter(([kind]) => kind === "enforce")
    .map(([, config]) => config)
  assert.deepEqual(
    enforced.map(({ limit, windowMs }) => ({ limit, windowMs })),
    [
      { limit: 1, windowMs: MERCHANT_OTP_RESEND_COOLDOWN_MS },
      { limit: 5, windowMs: MERCHANT_OTP_RESEND_WINDOW_MS },
    ]
  )
})

test("a blocked resend returns the latest durable non-sliding reset time", async () => {
  const cooldownRetryAt = "2026-07-09T12:01:00.000Z"
  const windowRetryAt = "2026-07-09T12:12:00.000Z"
  let enforceCalls = 0
  const dependencies = {
    enforceRateLimit: async () => {
      enforceCalls += 1
      throw new RateLimitError()
    },
    peekRateLimit: async ({ limit, windowMs }) => ({
      used: limit,
      limit,
      remaining: 0,
      windowMs,
      resetAt:
        windowMs === MERCHANT_OTP_RESEND_COOLDOWN_MS
          ? cooldownRetryAt
          : windowRetryAt,
    }),
  }

  await assert.rejects(
    enforceMerchantOtpResend(input, dependencies),
    (error) =>
      error instanceof MerchantOtpResendRateLimitError &&
      error.retryAt === windowRetryAt
  )
  assert.equal(
    enforceCalls,
    0,
    "preflight blocks without spending another bucket"
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

test("GET readback preserves the exhausted long window after cooldown expires", async () => {
  const windowRetryAt = "2026-07-09T12:14:00.000Z"
  const dependencies = {
    enforceRateLimit: async () => {
      throw new Error("readback must not spend a rate-limit bucket")
    },
    peekRateLimit: async ({ limit, windowMs }) => ({
      used:
        windowMs === MERCHANT_OTP_RESEND_WINDOW_MS
          ? limit
          : Math.max(0, limit - 1),
      limit,
      remaining:
        windowMs === MERCHANT_OTP_RESEND_WINDOW_MS ? 0 : Math.max(1, limit),
      windowMs,
      resetAt:
        windowMs === MERCHANT_OTP_RESEND_WINDOW_MS ? windowRetryAt : null,
    }),
  }

  assert.equal(
    await readMerchantOtpResendCooldown(input, dependencies),
    windowRetryAt
  )
})
