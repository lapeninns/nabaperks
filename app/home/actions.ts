"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import { findCustomerByVerifiedPhone } from "@/lib/customer/identity"
import { establishCustomerSessionAfterVerifiedPhone } from "@/lib/customer/access-continuity"
import { defaultCountryFromHeaders, normalizePhone } from "@/lib/customer/phone"
import {
  clearAllCustomerSessions,
  clearCustomerSession,
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  setPendingPhoneVerification,
} from "@/lib/customer/session"
import { primaryOtpChannel } from "@/lib/customer/otp-channel-core"
import {
  checkCustomerPhoneVerification,
  startCustomerPhoneVerification,
} from "@/lib/customer/verification"
import {
  enforceCustomerOtpSendRateLimit,
  enforceCustomerOtpVerifyRateLimit,
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
    /** The code was valid and this number has no cards. Offer a scan, not another code. */
    noCards?: boolean
    /** Focus the phone field after the customer asks to correct it. */
    editingContact?: boolean
  }
  errors?: {
    contact?: string
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
  const country = defaultCountryFromHeaders(requestHeaders)
  const requestIdentity = customerRateLimitIdentityFromHeaders(requestHeaders)
  const clientIp = trustedClientIp(requestHeaders)
  const deviceHash = customerDeviceHashFromHeaders(requestHeaders)
  const normalized = normalizePhone(rawContact, country)

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
  const requestedChannel = primaryOtpChannel(
    process.env.CUSTOMER_OTP_PRIMARY_CHANNEL
  )
  let sentChannel = requestedChannel
  if (admitted) {
    const verification = await startCustomerPhoneVerification(
      contact,
      requestedChannel
    )
    if (verification.status === "unavailable") {
      recordLoginCodeSendFailed("provider_unavailable")
      return {
        fields: { contact },
        errors: {
          form: "We couldn't send a code just now. Try again shortly.",
        },
      }
    }
    sentChannel = verification.channel
  }

  try {
    await setPendingPhoneVerification({
      purpose: "wallet",
      phone: contact,
      country: normalized.phone.country,
      channel: sentChannel,
    })
  } catch (error) {
    logVerificationSendFailure("wallet", error)
    recordLoginCodeSendFailed("pending_state_failed")

    return {
      fields: { contact },
      errors: {
        form: "Verification code could not be sent. Try again shortly.",
      },
    }
  }

  recordCustomerContactEvent({
    eventName: "customer_login_code_requested",
    metadata: { method: "phone", surface: "home_login" },
  })

  return {
    fields: { contact, otpSent: true },
    message:
      "If a code arrives for that number, enter it here. Otherwise scan a venue QR to join first.",
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
    return { errors: { contact: "Request a new phone code." } }
  }

  const contact = pending.phone

  if (!/^\d{4,8}$/.test(otp)) {
    return {
      fields: { contact, otpSent: true },
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
        fields: { contact, otpSent: true },
        errors: { form: "Too many code attempts. Request a new code shortly." },
      }
    }

    throw error
  }

  const verification = await checkCustomerPhoneVerification(contact, otp)

  if (verification.status === "unavailable") {
    return {
      fields: { contact, otpSent: true },
      errors: {
        form: "We couldn't check that code. Try again or request a new one.",
      },
    }
  }

  if (verification.status === "rejected") {
    return {
      fields: { contact, otpSent: true },
      errors: { form: "That code was not accepted." },
    }
  }

  const customer = await findCustomerByVerifiedPhone({
    e164: pending.phone,
    country: pending.country,
    last4: pending.phone.slice(-4),
  })

  if (!customer) {
    await clearPendingPhoneVerification()
    recordCustomerContactEvent({
      eventName: "customer_login_no_wallet",
      metadata: { method: "phone", surface: "home_login" },
    })
    return {
      fields: { contact, noCards: true },
      message:
        "No cards found for that number yet. Scan a venue QR to join first.",
    }
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
      fields: { contact, otpSent: true },
      errors: {
        form: "We couldn't confirm account continuity. Try again shortly.",
      },
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
  await clearAllCustomerSessions()
  redirect("/home/login")
}
