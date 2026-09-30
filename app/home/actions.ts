"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import {
  closeEmailFallback,
  openEmailFallback,
} from "@/lib/customer/email-fallback"
import { clearPendingEmailSignIn } from "@/lib/customer/email-sign-in"
import { findCustomerByVerifiedPhone } from "@/lib/customer/identity"
import { establishCustomerSessionAfterVerifiedPhone } from "@/lib/customer/access-continuity"
import { normalizePhone } from "@/lib/customer/phone"
import {
  clearAllCustomerSessions,
  clearCustomerSession,
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  setPendingPhoneVerification,
} from "@/lib/customer/session"
import { LOGIN_MESSAGES } from "@/lib/customer/login-copy"
import {
  parseOtpChannel,
  primaryOtpChannel,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
import { phoneCodeStepTiming } from "@/lib/customer/phone-code-email-fallback"
import {
  checkCustomerPhoneVerification,
  startCustomerPhoneVerification,
} from "@/lib/customer/verification"
import {
  enforceCustomerOtpSendRateLimit,
  enforceCustomerOtpVerifyRateLimit,
  releaseCustomerOtpVerifyAdmission,
} from "@/lib/customer/otp-rate-limit"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import {
  RateLimitError,
  customerDeviceHashFromHeaders,
  customerRateLimitIdentityFromHeaders,
  trustedClientIp,
} from "@/lib/security/rate-limit"

export type CustomerLoginOtpState = {
  fields?: {
    contact?: string
    /** A code has been sent — show the code entry step. */
    otpSent?: boolean
    /**
     * Seconds left, by the server's clock, before the phone code step may
     * offer email (30 seconds after the pending code was sent). The step
     * counts it down from when it appears, when email sign-in is on.
     */
    emailFallbackInSeconds?: number
    /**
     * When the server sent the pending phone code (epoch seconds). A resend
     * changes it, and the code step restarts its wait from the latest code.
     */
    phoneCodeSentAt?: number
    /**
     * No code went out (provider or pending state failure). The phone form
     * offers email beside the error while email sign-in is on, since this
     * customer never reaches the code step's fallback.
     */
    phoneSendFailed?: boolean
    /** The code was valid and this number or email has no cards. Offer a scan, not another code. */
    noCards?: boolean
    /** Focus the phone field after the customer asks to correct it. */
    editingContact?: boolean
    /**
     * The method this answer is about. Set once the customer has used or
     * picked a method, so the screen stays on it instead of reordering.
     */
    method?: "phone" | "email"
    /**
     * The channel that carried the pending phone code, so the code step names
     * it and offers a text when it went by WhatsApp.
     */
    channel?: OtpChannel
    /** The address the customer typed, to refill the field after a change. */
    email?: string
    /** Masked on the server ("j***@example.com") for the email code step. */
    maskedEmail?: string
    /** Epoch seconds when an email code may be resent. */
    retryAt?: number
  }
  errors?: {
    contact?: string
    email?: string
    otp?: string
    form?: string
  }
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function requestCustomerLoginOtpAction(
  _state: CustomerLoginOtpState,
  formData: FormData
): Promise<CustomerLoginOtpState> {
  const rawContact = value(formData, "contact")
  const requestHeaders = await headers()
  const requestIdentity = customerRateLimitIdentityFromHeaders(requestHeaders)
  const clientIp = trustedClientIp(requestHeaders)
  const deviceHash = customerDeviceHashFromHeaders(requestHeaders)
  const normalized = normalizePhone(rawContact)

  if (!normalized.ok) {
    return {
      fields: { contact: rawContact },
      errors: { contact: normalized.error },
    }
  }

  const contact = normalized.phone.e164

  const admitted = await enforceCustomerOtpSendRateLimit({
    phone: contact,
    requestIdentity,
    trustedIp: clientIp,
    scope: "wallet",
    deviceHash,
  })

  // Same primary channel as the join flow (WhatsApp by default), same
  // automatic fallback; the pending cookie records where the code went.
  // "Text me instead" names SMS on a resend.
  const requestedChannel =
    parseOtpChannel(value(formData, "channel")) ??
    primaryOtpChannel(process.env.CUSTOMER_OTP_PRIMARY_CHANNEL)
  const isResend = value(formData, "resend") === "1"
  let sentChannel = requestedChannel
  if (admitted) {
    const verification = await startCustomerPhoneVerification(
      contact,
      requestedChannel
    )
    if (verification.status === "unavailable") {
      recordLoginCodeSendFailed("provider_unavailable")
      // No code went out, so email is offered at once, on the server too.
      await openEmailFallback("wallet", "phone_send_failed")
      return {
        fields: { contact, phoneSendFailed: true },
        errors: { form: LOGIN_MESSAGES.sendFailed },
      }
    }
    sentChannel = verification.channel
  }

  let pendingCode: Awaited<ReturnType<typeof setPendingPhoneVerification>>
  try {
    pendingCode = await setPendingPhoneVerification({
      purpose: "wallet",
      phone: contact,
      country: normalized.phone.country,
      channel: sentChannel,
    })
  } catch (error) {
    logVerificationSendFailure("wallet", error)
    recordLoginCodeSendFailed("pending_state_failed")
    await openEmailFallback("wallet", "phone_send_failed")

    return {
      fields: { contact, phoneSendFailed: true },
      errors: { form: LOGIN_MESSAGES.sendFailed },
    }
  }

  // One sign-in per browser, and email now waits 30 seconds from this code.
  await clearPendingEmailSignIn()
  await closeEmailFallback()

  recordCustomerContactEvent({
    eventName: "customer_login_code_requested",
    metadata: { method: "phone", surface: "home_login" },
  })

  // The same answer whether or not the number holds a card; the code step
  // names where the code went, so a first send needs no status line.
  return {
    fields: loginPhoneCodeFields({ ...pendingCode, channel: sentChannel }),
    ...(isResend ? { message: LOGIN_MESSAGES.newCodeSent } : {}),
  }
}

function loginPhoneCodeFields(pending: {
  readonly phone: string
  readonly issuedAt: number
  readonly channel?: OtpChannel
}): NonNullable<CustomerLoginOtpState["fields"]> {
  return {
    contact: pending.phone,
    otpSent: true,
    ...(pending.channel ? { channel: pending.channel } : {}),
    ...phoneCodeStepTiming(pending.issuedAt, Date.now()),
  }
}

function recordLoginCodeSendFailed(
  reason: "provider_unavailable" | "pending_state_failed"
): void {
  recordCustomerContactEvent({
    eventName: "customer_login_code_send_failed",
    metadata: { method: "phone", surface: "home_login", reason },
  })
}

function logVerificationSendFailure(scope: "wallet", error: unknown): void {
  console.error("Customer verification send failed", {
    scope,
    reason: error instanceof Error ? error.message : "Unknown error",
  })
}

export async function verifyCustomerLoginOtpAction(
  _state: CustomerLoginOtpState,
  formData: FormData
): Promise<CustomerLoginOtpState> {
  const otp = value(formData, "otp")
  const next = safeNextPath(value(formData, "next"))
  const pending = await getPendingPhoneVerification()
  const requestHeaders = await headers()
  const requestIdentity = customerRateLimitIdentityFromHeaders(requestHeaders)

  if (!pending || pending.purpose !== "wallet") {
    // Back to the number, kept as the code step showed it, so the guest can
    // send a new code without typing it again.
    return {
      fields: { contact: value(formData, "contact") },
      errors: { contact: LOGIN_MESSAGES.codeExpired },
    }
  }

  const contact = pending.phone
  // Every answer that keeps the code step carries the server's wait.
  const codeStep = loginPhoneCodeFields(pending)

  if (!/^\d{4,8}$/.test(otp)) {
    return {
      fields: codeStep,
      errors: { otp: LOGIN_MESSAGES.codeMalformed },
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
        fields: codeStep,
        errors: { form: LOGIN_MESSAGES.tooManyTries },
      }
    }

    throw error
  }

  const verification = await checkCustomerPhoneVerification(contact, otp)
  // Only a rejected code counts towards the limit (QA BUG-030): an approved
  // one gives back the attempt the admission above reserved.
  if (verification.status === "approved") {
    await releaseCustomerOtpVerifyAdmission({ phone: contact, requestIdentity })
  }

  if (verification.status === "unavailable") {
    return {
      fields: codeStep,
      errors: { form: LOGIN_MESSAGES.checkFailed },
    }
  }

  if (verification.status === "rejected") {
    return {
      fields: codeStep,
      errors: { otp: LOGIN_MESSAGES.codeRejected },
    }
  }

  const customer = await findCustomerByVerifiedPhone({
    e164: pending.phone,
    country: pending.country,
    last4: pending.phone.slice(-4),
  })

  if (!customer) {
    await clearPendingPhoneVerification()
    // A wallet joined by email may be why: the scan step offers email.
    await openEmailFallback("wallet", "no_cards")
    recordCustomerContactEvent({
      eventName: "customer_login_no_wallet",
      metadata: { method: "phone", surface: "home_login" },
    })
    return { fields: { contact, noCards: true } }
  }

  let access: "authenticated" | "recovery"
  try {
    access = await establishCustomerSessionAfterVerifiedPhone({
      customer,
      customerWasCreated: false,
      phoneHmac: pending.phoneHmac,
      next,
    })
  } catch {
    return {
      fields: codeStep,
      errors: { form: LOGIN_MESSAGES.signInFailed },
    }
  }

  if (access === "recovery") redirect("/home/recover")
  recordCustomerContactEvent({
    eventName: "customer_login_verified",
    customerId: customer.id,
    metadata: { method: "phone", surface: "home_login" },
  })
  await clearPendingPhoneVerification()
  redirect(next)
}

export async function signOutCustomerAction() {
  await clearCustomerSession()
  redirect("/home/login")
}

export async function signOutAllCustomerDevicesAction() {
  const scope = await clearAllCustomerSessions()
  // Only this browser was signed out when the revoke-all migration is not
  // live yet: the login page says so rather than implying every device was
  // (QA BUG-012).
  redirect(
    scope === "this_device"
      ? "/home/login?signed_out=this_device"
      : "/home/login"
  )
}
