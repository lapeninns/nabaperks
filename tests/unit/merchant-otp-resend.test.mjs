import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MERCHANT_OTP_RESEND_COOLDOWN_MS,
  MERCHANT_OTP_RESEND_RECIPIENT_WINDOW_LIMIT,
  enforceInitialSignupRecipientBudget,
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
      // The recipient budget is debited LAST and carries no source identity,
      // so rotating IPs no longer buys a fresh allowance for this mailbox.
      {
        limit: MERCHANT_OTP_RESEND_RECIPIENT_WINDOW_LIMIT,
        windowMs: MERCHANT_OTP_RESEND_WINDOW_MS,
      },
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

test("initial signup records only the cooldown; the mailbox was charged pre-send", async () => {
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
  // The mailbox budget is debited by enforceInitialSignupRecipientBudget
  // BEFORE the provider call; charging it again here would bill one message
  // twice.
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

test("rotating the source identity cannot buy a fresh recipient allowance", () => {
  const a = merchantOtpResendKeys({ ...input, requestIdentity: "ip-hash-a" })
  const b = merchantOtpResendKeys({ ...input, requestIdentity: "ip-hash-b" })

  // The per-source buckets legitimately differ...
  assert.notEqual(a.cooldown, b.cooldown)
  assert.notEqual(a.window, b.window)

  // ...but the mailbox budget is the same bucket regardless of where the
  // request came from. This is the whole finding.
  assert.equal(a.recipientWindow, b.recipientWindow)
  assert.match(a.recipientWindow, /:recipient-window$/)
  assert.ok(
    !a.recipientWindow.includes("ip-hash-a"),
    "the recipient key must carry no source identity"
  )
})

test("a different mailbox or purpose is a different recipient budget", () => {
  const signup = merchantOtpResendKeys({ ...input, purpose: "signup" })
  const recovery = merchantOtpResendKeys({ ...input, purpose: "recovery" })
  const other = merchantOtpResendKeys({ ...input, email: "other@example.test" })

  assert.notEqual(signup.recipientWindow, recovery.recipientWindow)
  assert.notEqual(signup.recipientWindow, other.recipientWindow)
})

test("the first signup email is charged to the mailbox BEFORE it is sent", async () => {
  // recordInitialSignupOtpCooldown runs after the provider send, so it can
  // record a debit but never prevent a message. Without a pre-send gate the
  // first email to any mailbox bypassed the recipient cap, and rotating source
  // IPs still bought one free send each.
  const calls = []
  const dependencies = {
    enforceRateLimit: async (config) => {
      calls.push(config)
    },
    peekRateLimit: async () => ({ remaining: 1, resetAt: null }),
  }

  await enforceInitialSignupRecipientBudget(input, dependencies)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].limit, MERCHANT_OTP_RESEND_RECIPIENT_WINDOW_LIMIT)
  assert.match(calls[0].key, /:recipient-window$/)
  assert.ok(
    !calls[0].key.includes(input.requestIdentity),
    "the pre-send gate must not be rotatable by source"
  )
})

test("an exhausted mailbox budget blocks the signup send", async () => {
  const retryAt = "2026-08-02T12:15:00.000Z"
  const dependencies = {
    enforceRateLimit: async () => {
      throw new Error("should not reach the provider")
    },
    peekRateLimit: async () => ({ remaining: 0, resetAt: retryAt }),
  }

  await assert.rejects(
    () => enforceInitialSignupRecipientBudget(input, dependencies),
    (error) => error instanceof MerchantOtpResendRateLimitError
  )
})
