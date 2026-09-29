import "server-only"

import { headers } from "next/headers"

import {
  customerEmailAuthMode,
  emailSignInEnabled,
} from "@/lib/customer/email-auth-mode"
import { maskEmail } from "@/lib/customer/email-pii-core"
import { newestSignedOutJoinChallenge } from "@/lib/customer/email-sign-in-core"
import {
  getPendingEmailSignIn,
  readVerifiedEmailHandoff,
} from "@/lib/customer/email-sign-in"
import {
  getCurrentCustomer,
  type CurrentCustomer,
} from "@/lib/customer/identity"
import {
  getMembershipForCustomer,
  getMerchantJoinContext,
} from "@/lib/customer/join"
import { primaryOtpChannel } from "@/lib/customer/otp-channel-core"
import { emailFallbackOpenedFor } from "@/lib/customer/email-fallback"
import {
  emailFallbackOpen,
  phoneCodeEmailFallbackInSeconds,
} from "@/lib/customer/phone-code-email-fallback"
import { getPendingPhoneVerification } from "@/lib/customer/session"
import { getMerchantStampLocationRequirement } from "@/lib/customer/stamp"
import { logger } from "@/lib/observability/logger"
import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-id"

import type { JoinContext } from "./derive"

type JoinSearchParams = {
  qr?: string
  step?: string
}

/**
 * Impure loader for the join route. Resolves merchant availability, the current
 * session, an existing membership, and a pending OTP — then hands pure facts to
 * {@link deriveCustomerExperience}. The pending-OTP lookup is skipped once a
 * session exists (a verified customer is already past that step), an explicit
 * `step=phone` always returns the customer to the phone form, and `step=email`
 * opens the email form only once the server allows the email fallback.
 */
export async function loadJoinExperienceContext(
  merchantSlug: string,
  searchParams: JoinSearchParams
): Promise<JoinContext> {
  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>
  const requestHeaders = await headers()

  try {
    context = await getMerchantJoinContext(merchantSlug, searchParams.qr)
  } catch (error) {
    if (!(error instanceof Error)) throw error
    logger.error("customer_join_context_failed", {
      requestId:
        normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ??
        "unavailable",
      operation: "join_context_load",
      reason: "database_unavailable",
    })
    return { unavailable: true }
  }

  if (!context?.available) {
    return { unavailable: true }
  }

  const merchant = {
    name: context.merchant.business_name,
    slug: merchantSlug,
    termsUrl: `/merchant/${merchantSlug}/terms`,
  }
  const card = {
    name: context.loyaltyCard.card_name,
    stampsRequired: context.loyaltyCard.stamps_required,
    rewardTerms: context.loyaltyCard.reward_terms,
    collectionWindows: context.loyaltyCard.collection_windows,
    tradingDayStartsAt: context.loyaltyCard.trading_day_starts_at,
    rewardExpiresAfterDays: context.loyaltyCard.reward_expires_after_days,
    minimumSpendPence: context.loyaltyCard.minimum_spend_pence,
    oneTransactionPerStamp: context.loyaltyCard.one_transaction_per_stamp,
    rewardPool: context.loyaltyCard.reward_pool,
    rewardExamples: context.loyaltyCard.reward_examples,
  }
  // Geofence gate is only consumed by the final terms step (the only screen that
  // can issue the first stamp), so default it cheaply and resolve the real value
  // only once a session exists.
  const baseLocation = { requireGeofence: false, geofenceRadiusMeters: 150 }
  const base = {
    merchantId: context.merchant.id,
    qrCodeId: "qrCodeId" in context ? context.qrCodeId : undefined,
    merchant,
    card,
    qrId: searchParams.qr,
    step: searchParams.step,
    location: baseLocation,
    primaryChannel: primaryOtpChannel(process.env.CUSTOMER_OTP_PRIMARY_CHANNEL),
    emailMode: customerEmailAuthMode(),
  }

  const customer = await getCurrentCustomer()
  // Membership and the location policy are independent reads for a verified
  // customer, so they run together rather than one after the other.
  const [membership, location] = customer
    ? await Promise.all([
        getMembershipForCustomer(context.merchant.id, customer.id),
        getMerchantStampLocationRequirement(context.merchant.id),
      ])
    : [null, baseLocation]

  if (membership) {
    return {
      ...base,
      hasSession: true,
      pendingOtp: false,
      customerChannels: customer ? contactChannels(customer) : undefined,
      membership: {
        id: membership.id,
        current: membership.current_stamp_count,
      },
    }
  }

  if (customer) {
    return {
      ...base,
      location,
      hasSession: true,
      pendingOtp: false,
      customerChannels: contactChannels(customer),
      membership: null,
    }
  }

  // No session: a pending join verification means show the code step — unless the
  // customer explicitly asked for a contact step (`step=phone`, or `step=email`
  // once the server opens the email fallback).
  const emailStepAsked = searchParams.step === "email"
  const [email, pending, fallbackOpened] = await Promise.all([
    pendingEmailFacts(merchantSlug, searchParams.qr),
    getPendingPhoneVerification(),
    emailStepAsked ? emailFallbackOpenedFor("join") : false,
  ])
  const phoneCode = pending?.purpose === "join" ? pending : null
  // Phone first: `step=email` is only the phone code's fallback, so the
  // server checks it is open (30 seconds after the latest code, a failed
  // send, or an email sign-in already under way). Asked for early, the
  // visitor gets the phone step: the pending code if there is one. While
  // email sign-in is off there is no email step at all, so the gate never
  // opens and `step=email` keeps showing the pending code (QA BUG-018).
  const emailFallback =
    emailStepAsked &&
    emailSignInEnabled() &&
    emailFallbackOpen(
      {
        phoneCodeSentAt: phoneCode?.issuedAt ?? null,
        opened: fallbackOpened,
        emailInProgress:
          email.pendingIssuedAt !== undefined ||
          email.handoffIssuedAt !== undefined,
      },
      Date.now()
    )
  const contactStepRequested = searchParams.step === "phone" || emailFallback
  // Starting any challenge clears the others, but a cookie left from an older
  // step must never hide the one the visitor started last. An email code that
  // never reached the customer does not hide a phone code still pending: the
  // phone is where they came from.
  const emailCodeUndelivered = email.pendingEmail?.deliveryDelayed === true
  const newest = contactStepRequested
    ? null
    : newestSignedOutJoinChallenge({
        emailHandoff: email.handoffIssuedAt,
        emailCode:
          phoneCode && emailCodeUndelivered ? undefined : email.pendingIssuedAt,
        phoneCode: phoneCode?.issuedAt,
      })

  if (newest === "email_handoff" || newest === "email_code") {
    return {
      ...base,
      ...(newest === "email_handoff"
        ? { emailHandoff: email.emailHandoff }
        : { pendingEmail: email.pendingEmail }),
      hasSession: false,
      pendingOtp: false,
      phoneCodePending: phoneCode !== null,
      membership: null,
    }
  }

  if (newest === "phone_code" && phoneCode) {
    return {
      ...base,
      hasSession: false,
      pendingOtp: true,
      pendingPhone: phoneCode.phone,
      pendingChannel: phoneCode.channel,
      // A resend re-issues the pending cookie, so this is the latest send.
      // The server works out the wait, so a wrong device clock cannot offer
      // email early, and the step restarts its wait when this changes.
      pendingPhoneSentAt: phoneCode.issuedAt,
      pendingPhoneEmailFallbackInSeconds: phoneCodeEmailFallbackInSeconds(
        phoneCode.issuedAt,
        Date.now()
      ),
      membership: null,
    }
  }

  return {
    ...base,
    hasSession: false,
    pendingOtp: false,
    pendingPhone: undefined,
    emailFallbackOpen: emailFallback,
    // The email fallback keeps the phone code it came from one tap away.
    phoneCodePending: phoneCode !== null,
    membership: null,
  }
}

type PendingEmailFacts = {
  pendingEmail?: {
    maskedEmail: string
    resendAvailableAt: number
    deliveryDelayed?: boolean
  }
  pendingIssuedAt?: number
  emailHandoff?: { maskedEmail: string }
  handoffIssuedAt?: number
}

/**
 * Email sign-in facts for a signed-out visitor, read only while email sign-in
 * is on, with when each was issued so the newest challenge can win.
 */
async function pendingEmailFacts(
  merchantSlug: string,
  qrId: string | undefined
): Promise<PendingEmailFacts> {
  if (!emailSignInEnabled()) return {}

  const [handoff, pending] = await Promise.all([
    readVerifiedEmailHandoff({ merchantSlug, qrId }),
    getPendingEmailSignIn(),
  ])
  const facts: PendingEmailFacts = {}
  if (handoff) {
    facts.emailHandoff = { maskedEmail: maskEmail(handoff.email) ?? "" }
    facts.handoffIssuedAt = handoff.issuedAt
  }
  if (pending?.purpose === "join") {
    // A challenge whose code never reached the customer (`fail`) is kept in
    // case the email arrives late, but the code step must say it is delayed,
    // not that it was just sent. A failed resend after a delivered code stays
    // `sent`, since that code still works, and a refused (`held`) send still
    // reads as sent (D8).
    facts.pendingEmail = {
      maskedEmail: maskEmail(pending.email) ?? "",
      resendAvailableAt: pending.resendAvailableAt,
      ...(pending.delivery === "fail" ? { deliveryDelayed: true } : {}),
    }
    facts.pendingIssuedAt = pending.issuedAt
  }
  return facts
}

function contactChannels(customer: CurrentCustomer) {
  return {
    phone: customer.phoneLast4 !== null,
    email: Boolean(customer.email && customer.emailVerifiedAt),
  }
}
