import "server-only"

import { createHmac, randomInt, timingSafeEqual } from "node:crypto"

import { sendEmailOtp } from "@/lib/notifications/resend"
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
  setPendingEmailVerification,
} from "@/lib/customer/session"

type EmailVerificationStartResult = { status: "sent" }
type EmailVerificationCheckResult =
  | { status: "approved"; email: string }
  | { status: "rejected" }

/**
 * Email verification for the redeem-time profile gate. Email is optional, but a
 * customer who enters one must confirm it before redeeming. Mirrors the phone
 * flow: a one-time code is sent (here via Resend) and the pending state lives in a
 * short-lived signed cookie — we store the code's HMAC, never the code itself.
 */
export async function startCustomerEmailVerification(
  email: string
): Promise<EmailVerificationStartResult> {
  const code = generateCode()
  await setPendingEmailVerification({
    email,
    codeHmac: emailCodeHmac(email, code),
  })
  await sendEmailOtp({ to: email, code })

  return { status: "sent" }
}

export async function checkCustomerEmailVerification(
  code: string
): Promise<EmailVerificationCheckResult> {
  const pending = await getPendingEmailVerification()
  if (!pending) return { status: "rejected" }

  if (codeMatches(pending.email, code, pending.codeHmac)) {
    await clearPendingEmailVerification()
    return { status: "approved", email: pending.email }
  }

  return { status: "rejected" }
}

/** Deterministic HMAC binding a code to its address, signed with the cookie secret. */
export function emailCodeHmac(email: string, code: string): string {
  return createHmac("sha256", customerSessionSecret())
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex")
}

function codeMatches(email: string, code: string, expectedHmac: string): boolean {
  if (isApprovedDevOtp(code)) return true

  const actual = Buffer.from(emailCodeHmac(email, code), "hex")
  const expected = Buffer.from(expectedHmac, "hex")

  return (
    actual.byteLength === expected.byteLength &&
    timingSafeEqual(actual, expected)
  )
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

function isApprovedDevOtp(code: string): boolean {
  const devCode = process.env.CUSTOMER_DEV_OTP_CODE?.trim()

  return (
    process.env.NODE_ENV !== "production" && Boolean(devCode) && code === devCode
  )
}

function customerSessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()

  if (!secret) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET is required for customer email verification."
    )
  }

  return secret
}
