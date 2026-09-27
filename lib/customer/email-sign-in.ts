import "server-only"

import { randomUUID } from "node:crypto"

import { cookies, headers } from "next/headers"

import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import {
  approvedLocalDevOtp,
  isLocalDevOtpConfigured,
} from "@/lib/customer/dev-otp-core"
import {
  customerEmailHmac,
  maskEmail,
  normalizeEmail,
} from "@/lib/customer/email-pii-core"
import {
  EMAIL_HANDOFF_TTL_SECONDS,
  EMAIL_SIGN_IN_RESEND_AFTER_SECONDS,
  EMAIL_SIGN_IN_TTL_SECONDS,
  createPendingEmailSignInCookieValue,
  createVerifiedEmailHandoffCookieValue,
  emailSignInCodeHmac,
  emailSignInDigestsMatch,
  generateEmailSignInCode,
  isEmailSignInCodeShape,
  readPendingEmailSignInCookieValue,
  readVerifiedEmailHandoffCookieValue,
  verifiedEmailHandoffMatches,
  type EmailSignInPurpose,
  type PendingEmailSignInPayload,
  type VerifiedEmailHandoffPayload,
} from "@/lib/customer/email-sign-in-core"
import { isEmailAddress } from "@/lib/customer/profile-fields"
import { clearPendingPhoneVerification } from "@/lib/customer/session"
import { persistentCookieOptions } from "@/lib/http/persistent-cookie-options"
import { isDefinitiveProviderRejection } from "@/lib/notifications/provider-delivery-error"
import { sendEmailOtp } from "@/lib/notifications/resend"
import { logger } from "@/lib/observability/logger"
import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"
import {
  RateLimitError,
  customerDeviceHashFromHeaders,
  customerRateLimitIdentityFromHeaders,
  enforceRateLimit,
  rateLimitBucketHash,
  trustedClientIp,
} from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Signed-out email sign-in (join page and, later, /home/login).
 *
 * The pending challenge lives only in an encrypted HttpOnly cookie that holds
 * the code's digest, never the code (D6). Send admission, guess limits and
 * single use are Postgres rate-limit buckets. Every send answers the same way
 * for any address and when admission refuses (D8): the cookie is always set,
 * and a refused send mints a code that is never emailed.
 */

export const pendingEmailSignInCookieName = "nabaperks_pending_email_sign_in"
export const verifiedEmailHandoffCookieName = "nabaperks_email_handoff"

/** Guess limits (plan PR 3): per challenge, per address, per device. */
export const EMAIL_SIGN_IN_CHALLENGE_GUESS_LIMIT = 5
export const EMAIL_SIGN_IN_EMAIL_GUESS_LIMIT = 10
export const EMAIL_SIGN_IN_DEVICE_GUESS_LIMIT = 20
const CHALLENGE_WINDOW_MS = 15 * 60_000
const HOUR_MS = 60 * 60_000

export type EmailSignInStartResult =
  | {
      readonly status: "code_sent"
      readonly maskedEmail: string
      readonly resendAvailableAt: number
    }
  | { readonly status: "invalid_email" }
  | {
      readonly status: "delivery_failed"
      readonly maskedEmail: string
      readonly resendAvailableAt: number
    }

export type EmailSignInCheckResult =
  | {
      readonly status: "verified"
      readonly email: string
      readonly emailHmac: string
    }
  | { readonly status: "invalid_code" }
  | { readonly status: "expired" }
  | { readonly status: "rate_limited" }

export type EmailSignInOutcome =
  EmailSignInStartResult["status"] | EmailSignInCheckResult["status"]

type StartInput = {
  readonly email: string
  readonly purpose: EmailSignInPurpose
  /** Attributes a failed send to the venue on the join page. */
  readonly merchantId?: string | null
}

type AdmissionOutcome = "admitted" | "refused" | "unavailable"

export async function startEmailSignInChallenge(
  input: StartInput
): Promise<EmailSignInStartResult> {
  const email = normalizeEmail(input.email)
  if (email.length > 254 || !isEmailAddress(email)) {
    return { status: "invalid_email" }
  }

  const emailHmac = customerEmailHmac(email)
  const secret = requiredCustomerSessionSecret()
  const now = nowSeconds()
  const existing = await readPendingChallenge(secret, now)
  const current =
    existing?.purpose === input.purpose && existing.emailHmac === emailHmac
      ? existing
      : null

  // A double submit or an early resend keeps the code already on its way
  // instead of replacing it with one that admission would refuse to send.
  if (current && now < current.resendAvailableAt) {
    await writeChallenge(current, secret)
    return codeSent(current)
  }

  const admission = await admitSend(email, emailHmac)
  if (admission === "unavailable") {
    recordSendFailure(input)
    return deliveryFailed(email, now)
  }

  const code = generateEmailSignInCode()
  const payload =
    admission === "refused" && current
      ? {
          ...current,
          resendAvailableAt: now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS,
        }
      : mintChallenge({
          email,
          emailHmac,
          purpose: input.purpose,
          code,
          now,
          secret,
        })

  // The cookie is written whatever admission said, so the response never
  // reveals a refusal. Only one sign-in challenge is live per browser.
  await writeChallenge(payload, secret)
  await clearPendingPhoneVerification()
  await clearVerifiedEmailHandoff()

  if (admission === "refused" || isLocalDevOtpConfigured()) {
    return codeSent(payload)
  }

  try {
    await sendEmailOtp({ to: email, code, idempotencyKey: payload.challengeId })
  } catch (error) {
    // Never log the provider message: it can echo the recipient.
    logger.error("customer_email_sign_in_send_failed", {
      purpose: input.purpose,
      category: sendFailureCategory(error),
    })
    recordSendFailure(input)
    return { ...codeSent(payload), status: "delivery_failed" }
  }

  return codeSent(payload)
}

export async function checkEmailSignInChallenge({
  code,
  purpose,
}: {
  code: string
  purpose: EmailSignInPurpose
}): Promise<EmailSignInCheckResult> {
  const secret = requiredCustomerSessionSecret()
  const pending = await readPendingChallenge(secret, nowSeconds())
  if (!pending || pending.purpose !== purpose) return { status: "expired" }

  const devCode = approvedLocalDevOtp(code)
  if (!devCode && !isEmailSignInCodeShape(code)) {
    return { status: "invalid_code" }
  }

  const requestHeaders = await headers()
  const device =
    customerDeviceHashFromHeaders(requestHeaders) ??
    `identity:${customerRateLimitIdentityFromHeaders(requestHeaders)}`
  try {
    await enforceRateLimit({
      key: `email-sign-in:verify:challenge:${pending.challengeId}`,
      limit: EMAIL_SIGN_IN_CHALLENGE_GUESS_LIMIT,
      windowMs: CHALLENGE_WINDOW_MS,
    })
    await enforceRateLimit({
      key: `email-sign-in:verify:email:${pending.emailHmac}`,
      limit: EMAIL_SIGN_IN_EMAIL_GUESS_LIMIT,
      windowMs: HOUR_MS,
    })
    await enforceRateLimit({
      key: `email-sign-in:verify:device:${device}`,
      limit: EMAIL_SIGN_IN_DEVICE_GUESS_LIMIT,
      windowMs: HOUR_MS,
    })
  } catch (error) {
    if (error instanceof RateLimitError) return { status: "rate_limited" }
    throw error
  }

  const matches =
    devCode ||
    emailSignInDigestsMatch(
      emailSignInCodeHmac({
        secret,
        purpose: pending.purpose,
        challengeId: pending.challengeId,
        email: pending.email,
        code,
      }),
      pending.codeHmac
    )
  if (!matches) return { status: "invalid_code" }

  // Spent only after a match, so a wrong guess never uses up the challenge.
  try {
    await enforceRateLimit({
      key: `email-sign-in:consumed:${pending.challengeId}`,
      limit: 1,
      windowMs: CHALLENGE_WINDOW_MS,
    })
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error
    await clearPendingEmailSignIn()
    return { status: "expired" }
  }

  await clearPendingEmailSignIn()
  return {
    status: "verified",
    email: pending.email,
    emailHmac: pending.emailHmac,
  }
}

/** Read-only, so a page render may call it. */
export async function getPendingEmailSignIn(): Promise<PendingEmailSignInPayload | null> {
  return readPendingChallenge(requiredCustomerSessionSecret(), nowSeconds())
}

export async function clearPendingEmailSignIn(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(pendingEmailSignInCookieName)
}

/**
 * Records that this device verified `email` while no wallet held it. Bound to
 * the device, venue and QR; throws when the request carries no device.
 */
export async function setVerifiedEmailHandoff({
  email,
  emailHmac,
  merchantSlug,
  qrId,
}: {
  email: string
  emailHmac: string
  merchantSlug: string
  qrId: string | null
}): Promise<VerifiedEmailHandoffPayload> {
  const deviceHash = customerDeviceHashFromHeaders(await headers())
  if (!deviceHash) throw new Error("A verified customer device is required.")

  const issuedAt = nowSeconds()
  const payload: VerifiedEmailHandoffPayload = {
    version: 1,
    email,
    emailHmac,
    deviceHash,
    merchantSlug,
    qrId: qrId || null,
    issuedAt,
    expiresAt: issuedAt + EMAIL_HANDOFF_TTL_SECONDS,
  }
  const cookieStore = await cookies()
  cookieStore.set(
    verifiedEmailHandoffCookieName,
    createVerifiedEmailHandoffCookieValue(
      payload,
      requiredCustomerSessionSecret()
    ),
    persistentCookieOptions(EMAIL_HANDOFF_TTL_SECONDS)
  )
  return payload
}

/**
 * The handoff for this device, venue and QR, or null. Read-only (a page render
 * may call it); a mismatched handoff is ignored, never honoured.
 */
export async function readVerifiedEmailHandoff({
  merchantSlug,
  qrId,
}: {
  merchantSlug: string
  qrId: string | null | undefined
}): Promise<VerifiedEmailHandoffPayload | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(verifiedEmailHandoffCookieName)?.value
  if (!value) return null

  const result = readVerifiedEmailHandoffCookieValue(
    value,
    requiredCustomerSessionSecret(),
    nowSeconds()
  )
  if (!result.ok) return null

  const deviceHash = customerDeviceHashFromHeaders(await headers())
  return verifiedEmailHandoffMatches(result.payload, {
    deviceHash,
    merchantSlug,
    qrId,
  })
    ? result.payload
    : null
}

export async function clearVerifiedEmailHandoff(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(verifiedEmailHandoffCookieName)
}

async function readPendingChallenge(
  secret: string,
  now: number
): Promise<PendingEmailSignInPayload | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(pendingEmailSignInCookieName)?.value
  if (!value) return null
  const result = readPendingEmailSignInCookieValue(value, secret, now)
  return result.ok ? result.payload : null
}

async function writeChallenge(
  payload: PendingEmailSignInPayload,
  secret: string
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(
    pendingEmailSignInCookieName,
    createPendingEmailSignInCookieValue(payload, secret),
    persistentCookieOptions(Math.max(payload.expiresAt - nowSeconds(), 0))
  )
}

function mintChallenge({
  email,
  emailHmac,
  purpose,
  code,
  now,
  secret,
}: {
  email: string
  emailHmac: string
  purpose: EmailSignInPurpose
  code: string
  now: number
  secret: string
}): PendingEmailSignInPayload {
  const challengeId = randomUUID()
  return {
    version: 1,
    purpose,
    email,
    emailHmac,
    challengeId,
    codeHmac: emailSignInCodeHmac({
      secret,
      purpose,
      challengeId,
      email,
      code,
    }),
    issuedAt: now,
    expiresAt: now + EMAIL_SIGN_IN_TTL_SECONDS,
    resendAvailableAt: now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS,
  }
}

/**
 * All six buckets commit together in one RPC (PR 2); a refusal by any of them
 * spends none. Keys are hashed before they leave the process.
 */
async function admitSend(
  email: string,
  emailHmac: string
): Promise<AdmissionOutcome> {
  const requestHeaders = await headers()
  const device =
    customerDeviceHashFromHeaders(requestHeaders) ??
    `identity:${customerRateLimitIdentityFromHeaders(requestHeaders)}`
  const prefix = "customer-email-sign-in:send"
  const { error } = await createSupabaseServiceRoleClient().rpc(
    "admit_anonymous_customer_email_otp_send",
    {
      p_device_bucket: rateLimitBucketHash(`${prefix}:device:${device}`),
      p_ip_bucket: rateLimitBucketHash(
        `${prefix}:ip:${trustedClientIp(requestHeaders).toLowerCase()}`
      ),
      p_recipient_bucket: rateLimitBucketHash(
        `${prefix}:recipient:${emailHmac}`
      ),
      // Shared with the signed-in email flows (email-otp-cooldown.ts).
      p_cooldown_bucket: rateLimitBucketHash(
        `customer-email-otp:cooldown:${email}`
      ),
      p_global_minute_bucket: rateLimitBucketHash(`${prefix}:global:minute`),
      p_global_hour_bucket: rateLimitBucketHash(`${prefix}:global:hour`),
    }
  )
  if (!error) return "admitted"
  if (/rate limit exceeded/i.test(error.message)) {
    logger.warn("customer_email_sign_in_admission_refused", {})
    return "refused"
  }
  logger.error("customer_email_sign_in_admission_failed", {
    category: "admission_unavailable",
  })
  return "unavailable"
}

function recordSendFailure(input: StartInput): void {
  const join = input.purpose === "join"
  recordCustomerContactEvent({
    eventName: join
      ? "join_code_send_failed"
      : "customer_login_code_send_failed",
    merchantId: input.merchantId ?? null,
    metadata: {
      method: "email",
      surface: join ? "join" : "home_login",
      reason: "provider_unavailable",
    },
  })
}

/** A category and, for a provider rejection, only its HTTP status. */
function sendFailureCategory(error: unknown): string {
  if (isDefinitiveProviderRejection(error)) {
    const status = /\((\d{3})\)/.exec(error.message)?.[1]
    return status ? `provider_rejected_${status}` : "provider_rejected"
  }
  if (error instanceof Error && /not configured/i.test(error.message)) {
    return "not_configured"
  }
  return "provider_unavailable"
}

function codeSent(payload: PendingEmailSignInPayload) {
  return {
    status: "code_sent" as const,
    maskedEmail: maskEmail(payload.email) ?? "",
    resendAvailableAt: payload.resendAvailableAt,
  }
}

function deliveryFailed(email: string, now: number) {
  return {
    status: "delivery_failed" as const,
    maskedEmail: maskEmail(email) ?? "",
    resendAvailableAt: now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS,
  }
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
