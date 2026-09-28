import "server-only"

import { cookies } from "next/headers"

import {
  EMAIL_FALLBACK_COOKIE_NAME,
  EMAIL_FALLBACK_TTL_SECONDS,
  createEmailFallbackCookieValue,
  readEmailFallbackCookieValue,
  type EmailFallbackPurpose,
  type EmailFallbackReason,
} from "@/lib/customer/email-fallback-core"
import {
  getPendingEmailSignIn,
  readVerifiedEmailHandoff,
} from "@/lib/customer/email-sign-in"
import { emailFallbackOpen } from "@/lib/customer/phone-code-email-fallback"
import type { PendingPhonePayload } from "@/lib/customer/session-cookie"
import { getPendingPhoneVerification } from "@/lib/customer/session"
import { persistentCookieOptions } from "@/lib/http/persistent-cookie-options"
import { logger } from "@/lib/observability/logger"
import { requiredCustomerSessionSecret } from "@/lib/security/customer-session-secret"

/**
 * The server side of "phone first, email only as a fallback" (owner decision,
 * 28 September 2026). Email is open to a signed-out browser only when the
 * pending phone code for that flow is 30 seconds old by the server's clock,
 * when the flow has already opened email (a phone send that failed, a number
 * with no cards, or email taken once the wait was over), or while an email
 * sign-in for that flow is under way. Anything else gets the phone step.
 *
 * Every fact comes from this browser's own encrypted cookies, never from an
 * address or a number the request names, so a refusal says nothing about
 * anyone's wallet.
 */

export type EmailFallbackGate = {
  readonly open: boolean
  /** The pending phone code for this flow, so a refusal can show its step. */
  readonly phoneCode: PendingPhonePayload | null
}

/** Records that this flow opened email, for as long as a pending code lasts. */
export async function openEmailFallback(
  purpose: EmailFallbackPurpose,
  reason: EmailFallbackReason
): Promise<void> {
  try {
    const issuedAt = Math.floor(Date.now() / 1_000)
    const cookieStore = await cookies()
    cookieStore.set(
      EMAIL_FALLBACK_COOKIE_NAME,
      createEmailFallbackCookieValue(
        {
          version: 1,
          purpose,
          reason,
          issuedAt,
          expiresAt: issuedAt + EMAIL_FALLBACK_TTL_SECONDS,
        },
        requiredCustomerSessionSecret()
      ),
      persistentCookieOptions(EMAIL_FALLBACK_TTL_SECONDS)
    )
  } catch {
    // Best effort: without the record, email simply stays closed until the
    // phone code's own wait is over.
    logger.warn("customer_email_fallback_record_failed", { purpose, reason })
  }
}

/** A phone code was just sent: email waits 30 seconds from this one. */
export async function closeEmailFallback(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(EMAIL_FALLBACK_COOKIE_NAME)
}

/** Read-only, so a page render may call it. */
export async function emailFallbackOpenedFor(
  purpose: EmailFallbackPurpose
): Promise<boolean> {
  const cookieStore = await cookies()
  const value = cookieStore.get(EMAIL_FALLBACK_COOKIE_NAME)?.value
  if (!value) return false
  const result = readEmailFallbackCookieValue(
    value,
    requiredCustomerSessionSecret(),
    Math.floor(Date.now() / 1_000)
  )
  return result.ok && result.payload.purpose === purpose
}

/** The gate for /home/login's email actions. */
export async function walletEmailFallbackGate(): Promise<EmailFallbackGate> {
  const [pending, opened, email] = await Promise.all([
    getPendingPhoneVerification(),
    emailFallbackOpenedFor("wallet"),
    getPendingEmailSignIn(),
  ])
  const phoneCode = pending?.purpose === "wallet" ? pending : null
  return {
    open: emailFallbackOpen(
      {
        phoneCodeSentAt: phoneCode?.issuedAt ?? null,
        opened,
        emailInProgress: email?.purpose === "wallet",
      },
      Date.now()
    ),
    phoneCode,
  }
}

/** The gate for the join page's email request, for this venue and QR. */
export async function joinEmailFallbackGate(request: {
  readonly merchantSlug: string
  readonly qrId: string | null | undefined
}): Promise<EmailFallbackGate> {
  const [pending, opened, email, handoff] = await Promise.all([
    getPendingPhoneVerification(),
    emailFallbackOpenedFor("join"),
    getPendingEmailSignIn(),
    readVerifiedEmailHandoff({
      merchantSlug: request.merchantSlug,
      qrId: request.qrId || null,
    }),
  ])
  const phoneCode = pending?.purpose === "join" ? pending : null
  return {
    open: emailFallbackOpen(
      {
        phoneCodeSentAt: phoneCode?.issuedAt ?? null,
        opened,
        emailInProgress: email?.purpose === "join" || handoff !== null,
      },
      Date.now()
    ),
    phoneCode,
  }
}
