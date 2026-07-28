"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { after } from "next/server"

import { attachRewardInvitesForCustomer } from "@/lib/customer/reward-invites"
import { decryptCustomerEmail } from "@/lib/customer/email-encryption-core"
import { customerEmailHmac } from "@/lib/customer/email-pii-core"
import {
  clearInviteCookie,
  readInviteCookie,
} from "@/lib/loyalty-invites/invite-cookie"
import { triggerBirthdayIssuanceForCustomer } from "@/lib/rewards/issue-birthday"
import {
  getCurrentCustomer,
  getOrCreateCustomerByVerifiedPhone,
} from "@/lib/customer/identity"
import { captureJoinFunnelEvent } from "@/lib/customer/join-funnel"
import { joinEntry } from "@/lib/customer/join-observability-contract"
import { getMerchantJoinContext } from "@/lib/customer/join"
import { destinationForReturningQrVisit } from "@/lib/customer/returning-qr-redirect"
import { defaultCountryFromHeaders, normalizePhone } from "@/lib/customer/phone"
import {
  clearPendingPhoneVerification,
  commitPendingPhoneVerification,
  getPendingPhoneVerification,
  preparePendingPhoneVerification,
  setCustomerSession,
} from "@/lib/customer/session"
import {
  checkCustomerPhoneVerification,
  startCustomerPhoneVerification,
} from "@/lib/customer/verification"
import { classifyJoinRpcFailure } from "@/lib/customer/join-rpc-error"
import {
  enforceCustomerOtpSendRateLimit,
  enforceCustomerOtpVerifyRateLimit,
} from "@/lib/customer/otp-rate-limit"
import {
  RateLimitError,
  customerRateLimitIdentityFromHeaders,
  trustedClientIp,
} from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"
import { normalizeOtpInput } from "@/lib/customer/experience/otp-field"
import { logger } from "@/lib/observability/logger"
import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-id"
import { CUSTOMER_LEGAL_VERSION } from "@/lib/legal/content"

export type CustomerIdentityState = {
  fields?: {
    contact?: string
    merchantSlug?: string
    qrId?: string
    phoneOtpSent?: boolean
  }
  errors?: {
    contact?: string
    otp?: string
    form?: string
  }
  message?: string
}

export type CustomerJoinState = {
  errors?: {
    loyaltyTerms?: string
    form?: string
  }
}

const policyVersion = CUSTOMER_LEGAL_VERSION

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function requestCustomerIdentityAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  const submittedContact = value(formData, "contact")
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const ref = value(formData, "ref")
  const requestHeaders = await headers()
  const country = defaultCountryFromHeaders(requestHeaders)
  const requestIdentity = customerRateLimitIdentityFromHeaders(requestHeaders)
  const clientIp = trustedClientIp(requestHeaders)
  const pendingVerification = await getPendingPhoneVerification()
  const isTrustedResend =
    pendingVerification?.purpose === "join" && value(formData, "resend") === "1"
  const rawContact = isTrustedResend
    ? pendingVerification.phone
    : submittedContact
  const normalized = normalizePhone(rawContact, country)

  if (!normalized.ok) {
    return {
      fields: {
        ...(!isTrustedResend ? { contact: rawContact } : {}),
        merchantSlug,
        qrId,
      },
      errors: { contact: normalized.error },
    }
  }

  const contact = normalized.phone.e164
  const requestFields = {
    ...(!isTrustedResend ? { contact } : {}),
    merchantSlug,
    qrId,
  }

  let joinContext: Awaited<ReturnType<typeof getMerchantJoinContext>>
  try {
    joinContext = await getMerchantJoinContext(
      merchantSlug,
      qrId || undefined,
      requestIdentity
    )
  } catch {
    logger.error("customer_join_otp_context_failed", {
      operation: "validate_before_otp_send",
      reason: "join_context_unavailable",
    })
    return {
      fields: requestFields,
      errors: { form: "This loyalty card is unavailable just now." },
    }
  }

  if (!joinContext?.available) {
    return {
      fields: requestFields,
      errors: { form: "This loyalty card is unavailable just now." },
    }
  }

  try {
    await enforceCustomerOtpSendRateLimit({
      phone: contact,
      requestIdentity,
      trustedIp: clientIp,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        fields: requestFields,
        errors: { form: "Too many verification requests. Try again later." },
      }
    }

    throw error
  }

  try {
    const preparedVerification = await preparePendingPhoneVerification({
      purpose: "join",
      phone: contact,
      country: normalized.phone.country,
    })
    commitPendingPhoneVerification(preparedVerification)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    logVerificationSendFailure("join", error)

    return {
      fields: requestFields,
      errors: {
        form: "Verification code could not be sent. Try again shortly.",
      },
    }
  }

  const verification = await startCustomerPhoneVerification(contact)
  if (verification.status === "unavailable") {
    return {
      fields: requestFields,
      errors: {
        form: "We couldn't send a code just now. Try again shortly.",
      },
    }
  }

  await captureJoinFunnelEvent({
    eventName: "join_phone_requested",
    merchantId: joinContext.merchant.id,
    entry: joinEntry({ qrId, referralCode: ref }),
    step: "phone",
  })

  // A resend from the OTP step answers in place instead of redirecting, so
  // the form can announce the outcome inside its live-region card
  // (CUS-P1-02). The phone step never sends this field and keeps the
  // redirect that advances it to the OTP step — semantics unchanged.
  if (value(formData, "resend") === "1") {
    return {
      fields: { merchantSlug, qrId, phoneOtpSent: true },
      message: "New code sent. It can take a moment to arrive.",
    }
  }

  redirect(
    buildCustomerJoinHref(merchantSlug, {
      qrId: qrId || undefined,
      referralCode: ref || undefined,
      step: "otp",
    })
  )
}

function logVerificationSendFailure(scope: "join", error: unknown): void {
  console.error("Customer verification send failed", {
    scope,
    reason: error instanceof Error ? error.message : "Unknown error",
  })
}

export async function verifyCustomerOtpAction(
  _state: CustomerIdentityState,
  formData: FormData
): Promise<CustomerIdentityState> {
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const ref = value(formData, "ref")
  const otp = normalizeOtpInput(value(formData, "otp"))
  const pending = await getPendingPhoneVerification()
  const requestHeaders = await headers()
  const requestIdentity = customerRateLimitIdentityFromHeaders(requestHeaders)

  if (!pending || pending.purpose !== "join") {
    return {
      errors: { contact: "That code has expired. Request a new one." },
    }
  }

  const contact = pending.phone

  if (!/^\d{4,8}$/.test(otp)) {
    return {
      fields: { merchantSlug, qrId, phoneOtpSent: true },
      errors: { otp: "Enter the verification code." },
    }
  }

  try {
    await enforceCustomerOtpVerifyRateLimit({
      phone: contact,
      requestIdentity,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        fields: { merchantSlug, qrId, phoneOtpSent: true },
        errors: { form: "Too many code attempts. Request a new code shortly." },
      }
    }

    throw error
  }

  const verification = await checkCustomerPhoneVerification(contact, otp)

  if (verification.status === "unavailable") {
    return {
      fields: { merchantSlug, qrId, phoneOtpSent: true },
      errors: {
        form: "We couldn't check that code. Try again or request a new one.",
      },
    }
  }

  if (verification.status === "rejected") {
    return {
      fields: { merchantSlug, qrId, phoneOtpSent: true },
      errors: { otp: "That code was not accepted." },
    }
  }

  const customer = await getOrCreateCustomerByVerifiedPhone({
    e164: pending.phone,
    country: pending.country,
    last4: pending.phone.slice(-4),
  })
  await setCustomerSession(customer.id)
  await clearPendingPhoneVerification()
  await captureJoinFunnelEvent({
    eventName: "join_otp_verified",
    customerId: customer.id,
    scopeKey: merchantSlug,
    entry: joinEntry({ qrId, referralCode: ref }),
    step: "otp",
  })

  if (qrId) {
    const destination = await destinationForReturningQrVisit(
      merchantSlug,
      qrId,
      requestIdentity
    )
    if (destination) redirect(destination)
  }

  redirect(
    buildCustomerJoinHref(merchantSlug, {
      qrId: qrId || undefined,
      referralCode: ref || undefined,
      step: "terms",
    })
  )
}

/**
 * Consume a bulk two-stamp loyalty invitation for this venue, if the encrypted
 * cookie set by /invite/[token] is present. Returns null when there is no
 * invitation for this merchant (so the caller does a normal join); redirects to
 * the card on a claim or existing membership; otherwise returns an error state.
 */
async function claimLoyaltyInviteIfPresent(
  customerId: string,
  merchantSlug: string,
  marketingOptIn: boolean
): Promise<CustomerJoinState | null> {
  const cookie = await readInviteCookie()
  if (!cookie || cookie.merchantSlug !== merchantSlug) return null

  const supabase = createSupabaseServiceRoleClient()
  const { data: recipient } = await supabase
    .from("loyalty_invite_recipients")
    .select("email_ciphertext")
    .eq("claim_token_hash", cookie.claimTokenHash)
    .maybeSingle()

  if (!recipient?.email_ciphertext) {
    await clearInviteCookie()
    return null
  }

  let invitedEmail: string
  let invitedHmac: string
  try {
    invitedEmail = decryptCustomerEmail(recipient.email_ciphertext)
    invitedHmac = customerEmailHmac(invitedEmail)
  } catch {
    await clearInviteCookie()
    return null
  }

  const { data, error } = await supabase.rpc("claim_loyalty_invite", {
    p_customer_id: customerId,
    p_claim_token_hash: cookie.claimTokenHash,
    p_policy_version: policyVersion,
    p_marketing_opt_in: marketingOptIn,
    p_verified_email: invitedEmail,
    p_verified_email_hmac: invitedHmac,
  })
  await clearInviteCookie()

  if (error) {
    return {
      errors: {
        form: "We couldn't add your welcome stamps. Try again or ask the venue.",
      },
    }
  }

  const row = Array.isArray(data) ? data[0] : data
  const status = row?.status as string | undefined
  const membershipId = row?.membership_id as string | undefined

  if (status === "claimed" && membershipId) {
    after(() => triggerBirthdayIssuanceForCustomer(customerId))
    after(() => attachRewardInvitesForCustomer(customerId))
    redirect(`/card/${membershipId}?welcome=1&invite=1`)
  }
  if (status === "already_member" && membershipId) {
    redirect(`/card/${membershipId}?membership=existing`)
  }
  if (status === "email_conflict") {
    return {
      errors: {
        form: "This invitation was sent to a different email than your account uses, so no welcome stamps were added.",
      },
    }
  }
  if (status === "expired") {
    return {
      errors: {
        form: "This invitation has expired, so no welcome stamps were added.",
      },
    }
  }
  if (status === "card_too_short" || status === "unavailable") {
    return {
      errors: {
        form: "This venue's loyalty card isn't available right now, so no welcome stamps were added.",
      },
    }
  }

  // 'invalid' / consumed elsewhere — fall through to a normal join.
  return null
}

export async function joinRewardsAction(
  _state: CustomerJoinState,
  formData: FormData
): Promise<CustomerJoinState> {
  const customer = await getCurrentCustomer()
  const merchantSlug = value(formData, "merchantSlug")
  const qrId = value(formData, "qrId")
  const ref = value(formData, "ref")
  const acceptedTerms = formData.get("loyaltyTerms") === "on"
  const marketingOptIn = formData.get("marketingOptIn") === "on"

  if (!customer) {
    return { errors: { form: "Verify your phone before joining." } }
  }

  if (!acceptedTerms) {
    return { errors: { loyaltyTerms: "Accept the loyalty terms to join." } }
  }

  // Bulk two-stamp loyalty invitation: if this join carries a validated
  // invitation cookie for THIS venue, consume it in one atomic transaction
  // (membership + immutable terms + exactly two welcome stamps) instead of the
  // normal QR-first-stamp join. Redirects on success; returns an error state on
  // a non-award outcome; falls through to a normal join only if there is none.
  const inviteState = await claimLoyaltyInviteIfPresent(
    customer.id,
    merchantSlug,
    marketingOptIn
  )
  if (inviteState) return inviteState

  const supabase = createSupabaseServiceRoleClient()
  // Omit p_ref unless a referral code is actually present, so the call still
  // resolves against the pre-referral 7-arg RPC. This decouples the deploy from
  // the migration: ordinary joins keep working before `p_ref` lands on the DB,
  // and only referral-link joins (none exist yet) need the migration applied.
  const joinArgs = {
    p_customer_id: customer.id,
    p_merchant_slug: merchantSlug,
    p_qr_id: qrId || null,
    p_marketing_opt_in: marketingOptIn,
    p_policy_version: policyVersion,
  }
  const { data, error } = await supabase.rpc(
    "join_customer_membership_with_first_stamp",
    ref ? { ...joinArgs, p_ref: ref } : joinArgs
  )

  if (error) {
    const requestHeaders = await headers()
    logger.error("customer_join_rpc_failed", {
      requestId:
        normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ??
        "unavailable",
      operation: "join_membership",
      reason: classifyJoinRpcFailure(error),
    })
    return {
      errors: {
        form: "Rewards could not be joined. Try again or ask the venue team.",
      },
    }
  }

  const row = data?.[0]
  const membershipId = row?.membership_id
  const merchantId = row?.merchant_id
  const firstStampIssued = row?.first_stamp_issued === true
  const geoFlagged = row?.geo_flagged === true

  await captureJoinFunnelEvent({
    eventName: "join_terms_accepted",
    merchantId: merchantId ?? null,
    scopeKey: merchantSlug,
    customerId: customer.id,
    membershipId: membershipId ?? null,
    entry: joinEntry({ qrId, referralCode: ref }),
    step: "terms",
  })

  if (qrId) {
    await captureJoinFunnelEvent({
      eventName: firstStampIssued
        ? "join_first_stamp_issued"
        : "join_first_stamp_pending",
      merchantId: merchantId ?? null,
      customerId: customer.id,
      membershipId: membershipId ?? null,
      entry: joinEntry({ qrId, referralCode: ref }),
      step: "terms",
    })
    if (!firstStampIssued) {
      logger.warn("customer_join_first_stamp_pending", {
        membershipId: membershipId ?? "unavailable",
        reason: row?.first_stamp_reason ?? "unknown",
        resolution: row?.first_stamp_resolution ?? "unknown",
      })
    }
  }

  if (membershipId) {
    // A member who already set a birthday may be owed a treat here — issue it
    // best-effort. `after` callbacks registered before the redirect throw still
    // run, so this survives the redirect below.
    after(() => triggerBirthdayIssuanceForCustomer(customer.id))

    // A merchant may have sent this member a reward invite before they joined —
    // now that they have a membership, attach any match.
    after(() => attachRewardInvitesForCustomer(customer.id))

    const params = new URLSearchParams({ welcome: "1" })
    if (firstStampIssued) params.set("stamp", "issued")
    if (geoFlagged) params.set("geo", "flagged")
    redirect(`/card/${membershipId}?${params.toString()}`)
  }

  redirect(
    `/m/${merchantSlug}/join?${qrId ? `qr=${encodeURIComponent(qrId)}&` : ""}${
      ref ? `ref=${encodeURIComponent(ref)}&` : ""
    }membership=existing`
  )
}
