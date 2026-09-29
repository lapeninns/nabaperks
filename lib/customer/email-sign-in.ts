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
  PENDING_EMAIL_SIGN_IN_COOKIE_NAME,
  VERIFIED_EMAIL_HANDOFF_COOKIE_NAME,
  createPendingEmailSignInCookieValue,
  createVerifiedEmailHandoffCookieValue,
  emailSignInCodeHmac,
  emailSignInDigestsMatch,
  generateEmailSignInCode,
  isEmailSignInCodeShape,
  readPendingEmailSignInCookieValue,
  readVerifiedEmailHandoffCookieValue,
  unguessableEmailSignInDigest,
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
 * and a refused send mints a `held` challenge that has no code, so it looks
 * the same but can never be verified.
 */

export const pendingEmailSignInCookieName = PENDING_EMAIL_SIGN_IN_COOKIE_NAME
export const verifiedEmailHandoffCookieName = VERIFIED_EMAIL_HANDOFF_COOKIE_NAME

/** Guess limits (plan PR 3): per challenge, per address, per device, per IP. */
export const EMAIL_SIGN_IN_CHALLENGE_GUESS_LIMIT = 5
export const EMAIL_SIGN_IN_EMAIL_GUESS_LIMIT = 10
export const EMAIL_SIGN_IN_DEVICE_GUESS_LIMIT = 20
/** Matches the per-IP send limit: a venue's Wi-Fi shares one address. */
export const EMAIL_SIGN_IN_IP_GUESS_LIMIT = 60
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
  | EmailSignInVerified
  | { readonly status: "invalid_code" }
  | { readonly status: "expired" }
  | { readonly status: "rate_limited" }

/**
 * A matched code. The challenge it matched is spent and its cookie cleared;
 * `retryChallenge` is a fresh challenge for the same code under a new ID, which
 * the caller restores only when the sign-in after verification fails (see
 * {@link keepEmailSignInForRetry}).
 */
export type EmailSignInVerified = {
  readonly status: "verified"
  readonly email: string
  readonly emailHmac: string
  readonly retryChallenge: PendingEmailSignInPayload
}

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

  const now = nowSeconds()
  const emailHmac = emailHmacOrNull(email, input.purpose)
  if (!emailHmac) {
    return deliveryFailed(email, now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS)
  }
  const secret = requiredCustomerSessionSecret()
  const existing = await readPendingChallenge(secret, now)
  const current =
    existing?.purpose === input.purpose && existing.emailHmac === emailHmac
      ? existing
      : null

  // A double submit or an early resend keeps the challenge already live
  // instead of replacing it with one that admission would refuse to send. A
  // challenge with no delivered code keeps saying so until it may be resent.
  if (current && now < current.resendAvailableAt) {
    await writeChallenge(current, secret)
    return answerFor(current)
  }

  const admission = await admitSend(email, emailHmac)
  if (admission === "unavailable") {
    recordSendFailure(input)
    return deliveryFailed(email, now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS)
  }

  if (admission === "refused") {
    // The answer and the cookie look the same as an admitted send (D8), but a
    // new challenge is `held`: no code exists, so it can never be verified.
    const held: PendingEmailSignInPayload = current
      ? {
          ...current,
          resendAvailableAt: now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS,
        }
      : mintChallenge({ email, emailHmac, purpose: input.purpose, now, secret })
    await makeOnlyLiveChallenge(held, secret)
    return answerFor(held)
  }

  const code = generateEmailSignInCode()
  const payload = mintChallenge({
    email,
    emailHmac,
    purpose: input.purpose,
    code,
    now,
    secret,
  })
  if (!isLocalDevOtpConfigured()) {
    try {
      await sendEmailOtp({
        to: email,
        code,
        idempotencyKey: payload.challengeId,
      })
    } catch (error) {
      // Never log the provider message: it can echo the recipient.
      logger.error("customer_email_sign_in_send_failed", {
        purpose: input.purpose,
        category: sendFailureCategory(error),
      })
      recordSendFailure(input)
      const resendAvailableAt = now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS
      await makeOnlyLiveChallenge(
        keptAfterFailedSend(current, payload, resendAvailableAt),
        secret
      )
      // This attempt failed whatever is kept, so the action says so in place.
      return deliveryFailed(email, resendAvailableAt)
    }
  }

  await makeOnlyLiveChallenge(payload, secret)
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

  const held = pending.delivery === "held"
  try {
    await enforceGuessLimits(pending, held)
  } catch (error) {
    if (error instanceof RateLimitError) return { status: "rate_limited" }
    throw error
  }

  // A refused send has no code, so nothing can match it, the dev code
  // included. Its guesses are still charged to the challenge, device and IP.
  if (held) return { status: "invalid_code" }

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
    retryChallenge: rebindChallenge(pending, code, secret),
  }
}

/**
 * Restores a verified code as a new challenge after the sign-in that followed
 * it failed (a lookup, handoff or session error), so the customer can enter
 * the same code again instead of waiting for another email.
 *
 * Replay stays closed: the challenge ID that matched is already spent, so a
 * copy of the old cookie is refused, and the restored challenge has its own
 * ID, spent on its next match. It keeps the original expiry, so retries never
 * extend the code's life, and it is only minted after a correct code, so it
 * gives nobody extra guesses.
 */
export async function keepEmailSignInForRetry(
  verified: EmailSignInVerified
): Promise<void> {
  if (verified.retryChallenge.expiresAt <= nowSeconds()) return
  await writeChallenge(verified.retryChallenge, requiredCustomerSessionSecret())
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
    handoffId: randomUUID(),
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

/**
 * Spends the handoff server-side. Only the first call for a handoff returns
 * true, so a copied cookie cannot be replayed to sign in to the wallet it
 * created. Deleting the cookie alone would only stop this browser.
 */
export async function consumeVerifiedEmailHandoff(
  handoff: VerifiedEmailHandoffPayload
): Promise<boolean> {
  try {
    await enforceRateLimit({
      key: `email-handoff:consumed:${handoff.handoffId}`,
      limit: 1,
      windowMs: EMAIL_HANDOFF_TTL_SECONDS * 1000,
    })
    return true
  } catch (error) {
    if (error instanceof RateLimitError) return false
    throw error
  }
}

/**
 * Re-issues a spent handoff under a new ID after the wallet start that spent
 * it failed, so the customer can try again without another code. The spent ID
 * stays spent, so a copy of the old cookie is still refused; the new one keeps
 * the original binding and expiry. Null once the handoff has expired.
 */
export async function reissueVerifiedEmailHandoff(
  spent: VerifiedEmailHandoffPayload
): Promise<VerifiedEmailHandoffPayload | null> {
  const now = nowSeconds()
  if (spent.expiresAt <= now) return null

  const payload: VerifiedEmailHandoffPayload = {
    ...spent,
    handoffId: randomUUID(),
  }
  const cookieStore = await cookies()
  cookieStore.set(
    verifiedEmailHandoffCookieName,
    createVerifiedEmailHandoffCookieValue(
      payload,
      requiredCustomerSessionSecret()
    ),
    persistentCookieOptions(spent.expiresAt - now)
  )
  return payload
}

/**
 * Guess limits: per challenge, per device and per client IP always; per
 * address only for a challenge whose code was sent, since guesses against a
 * refused (`held`) one cannot succeed and must not lock the address out.
 */
async function enforceGuessLimits(
  pending: PendingEmailSignInPayload,
  held: boolean
): Promise<void> {
  const requestHeaders = await headers()
  const device =
    customerDeviceHashFromHeaders(requestHeaders) ??
    `identity:${customerRateLimitIdentityFromHeaders(requestHeaders)}`
  await enforceRateLimit({
    key: `email-sign-in:verify:challenge:${pending.challengeId}`,
    limit: EMAIL_SIGN_IN_CHALLENGE_GUESS_LIMIT,
    windowMs: CHALLENGE_WINDOW_MS,
  })
  if (!held) {
    await enforceRateLimit({
      key: `email-sign-in:verify:email:${pending.emailHmac}`,
      limit: EMAIL_SIGN_IN_EMAIL_GUESS_LIMIT,
      windowMs: HOUR_MS,
    })
  }
  await enforceRateLimit({
    key: `email-sign-in:verify:device:${device}`,
    limit: EMAIL_SIGN_IN_DEVICE_GUESS_LIMIT,
    windowMs: HOUR_MS,
  })
  // Rotating the device cookie is cheap, so the IP caps guesses too.
  await enforceRateLimit({
    key: `email-sign-in:verify:ip:${trustedClientIp(requestHeaders).toLowerCase()}`,
    limit: EMAIL_SIGN_IN_IP_GUESS_LIMIT,
    windowMs: HOUR_MS,
  })
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

/** A new challenge; without a code it is `held` and can never be verified. */
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
  code?: string
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
    codeHmac:
      code === undefined
        ? unguessableEmailSignInDigest()
        : emailSignInCodeHmac({ secret, purpose, challengeId, email, code }),
    delivery: code === undefined ? "held" : "sent",
    issuedAt: now,
    expiresAt: now + EMAIL_SIGN_IN_TTL_SECONDS,
    resendAvailableAt: now + EMAIL_SIGN_IN_RESEND_AFTER_SECONDS,
  }
}

/**
 * The challenge kept after a send failed. `delivery` records whether this
 * browser was told a code is on its way, not how the latest send went; the
 * action reports that failure in place.
 *
 * - After a delivered code (`sent`), that code keeps working and the page
 *   keeps saying it was sent, which is true.
 * - After a refused send (`held`), the page already said a code was sent
 *   (D8), so it must keep saying so exactly as for `sent`. The new code is
 *   kept, so an email that arrives late still works.
 * - Otherwise no code has reached the customer: the new code is kept in case
 *   it arrives late, and the page says it is delayed (`fail`).
 */
function keptAfterFailedSend(
  current: PendingEmailSignInPayload | null,
  attempted: PendingEmailSignInPayload,
  resendAvailableAt: number
): PendingEmailSignInPayload {
  if (current?.delivery === "sent") return { ...current, resendAvailableAt }
  return {
    ...attempted,
    delivery: current?.delivery === "held" ? "sent" : "fail",
    resendAvailableAt,
  }
}

/**
 * The same code under a new challenge ID, for {@link keepEmailSignInForRetry}.
 * The code matched, so it was delivered, whatever the challenge said before.
 */
function rebindChallenge(
  pending: PendingEmailSignInPayload,
  code: string,
  secret: string
): PendingEmailSignInPayload {
  const challengeId = randomUUID()
  return {
    ...pending,
    delivery: "sent",
    challengeId,
    codeHmac: emailSignInCodeHmac({
      secret,
      purpose: pending.purpose,
      challengeId,
      email: pending.email,
      code,
    }),
  }
}

/**
 * Writes the challenge and drops the other signed-out sign-in state, so only
 * one challenge is live per browser once an email code is on its way (`sent`,
 * or `held`, which must look the same, D8). A challenge whose code never
 * reached the customer (`fail`) keeps a phone code still pending: the phone
 * is where they came from, and "Use my phone number instead" returns to it.
 */
async function makeOnlyLiveChallenge(
  payload: PendingEmailSignInPayload,
  secret: string
): Promise<void> {
  await writeChallenge(payload, secret)
  if (payload.delivery !== "fail") await clearPendingPhoneVerification()
  await clearVerifiedEmailHandoff()
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

/**
 * The address's HMAC, or null when email identity is not configured (no
 * CUSTOMER_EMAIL_HMAC_SECRET). The deploy gate refuses email sign-in without
 * it (scripts/check-env.mjs); if it still reaches runtime, the guest gets the
 * usual "could not send" answer instead of an error page (QA BUG-016). The
 * warning names only the purpose, never the address.
 */
function emailHmacOrNull(
  email: string,
  purpose: EmailSignInPurpose
): string | null {
  try {
    return customerEmailHmac(email)
  } catch {
    logger.warn("customer_email_sign_in_unavailable", {
      purpose,
      category: "not_configured",
    })
    return null
  }
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

function deliveryFailed(email: string, resendAvailableAt: number) {
  return {
    status: "delivery_failed" as const,
    maskedEmail: maskEmail(email) ?? "",
    resendAvailableAt,
  }
}

/** A `held` challenge answers as sent (D8); one never delivered never does. */
function answerFor(payload: PendingEmailSignInPayload): EmailSignInStartResult {
  return payload.delivery === "fail"
    ? deliveryFailed(payload.email, payload.resendAvailableAt)
    : codeSent(payload)
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
