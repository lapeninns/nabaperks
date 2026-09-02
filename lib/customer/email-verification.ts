import "server-only"

import { createHmac, randomInt, timingSafeEqual } from "node:crypto"

import { sendEmailOtp } from "@/lib/notifications/resend"
import {
  clearPendingEmailVerification,
  getCustomerSession,
  getPendingEmailVerification,
  setPendingEmailVerification,
} from "@/lib/customer/session"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"

type EmailVerificationStartResult = { status: "sent" }
type EmailVerificationCheckResult =
  { status: "approved"; email: string } | { status: "rejected" }

/**
 * Email verification for the reward-collection profile gate. Email is optional,
 * but a customer who enters one must confirm it before collection. Mirrors the
 * phone flow: a one-time code is sent (here via Resend) and the pending state
 * lives in a short-lived signed cookie — we store the code's HMAC, never the
 * code itself.
 */
export async function startCustomerEmailVerification(
  email: string
): Promise<EmailVerificationStartResult> {
  const normalizedEmail = normalizeEmail(email)
  const customerSession = await getCustomerSession()
  if (!customerSession) {
    throw new Error("A customer session is required for email verification.")
  }
  await enforceRateLimit({
    key: `customer-email-verification-send:customer:${customerSession.customerId}`,
    limit: 6,
    windowMs: 24 * 60 * 60_000,
  })
  await enforceRateLimit({
    key: `customer-email-verification-send:${normalizedEmail}`,
    limit: 3,
    windowMs: 15 * 60_000,
  })

  const code = generateCode()
  await setPendingEmailVerification({
    email: normalizedEmail,
    codeHmac: emailCodeHmac(normalizedEmail, code),
    customerId: customerSession.customerId,
  })
  await sendEmailOtp({ to: normalizedEmail, code })

  return { status: "sent" }
}

export async function checkCustomerEmailVerification(
  code: string
): Promise<EmailVerificationCheckResult> {
  const pending = await getPendingEmailVerification()
  if (!pending) return { status: "rejected" }
  const customerSession = await getCustomerSession()
  if (!customerSession || pending.customerId !== customerSession.customerId) {
    await clearPendingEmailVerification()
    return { status: "rejected" }
  }

  await enforceRateLimit({
    key: `customer-email-verification-check:${normalizeEmail(pending.email)}`,
    limit: 5,
    windowMs: 15 * 60_000,
  })

  if (codeMatches(pending.email, code, pending.codeHmac)) {
    await clearPendingEmailVerification()
    return { status: "approved", email: pending.email }
  }

  return { status: "rejected" }
}

/** Deterministic HMAC binding a code to its address, signed with the cookie secret. */
export function emailCodeHmac(email: string, code: string): string {
  return createHmac("sha256", requiredCustomerSessionSecret())
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex")
}

function codeMatches(
  email: string,
  code: string,
  expectedHmac: string
): boolean {
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isApprovedDevOtp(code: string): boolean {
  const devCode = process.env.CUSTOMER_DEV_OTP_CODE?.trim()

  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(devCode) &&
    code === devCode
  )
}
