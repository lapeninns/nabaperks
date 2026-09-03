"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { findCustomerByVerifiedPhone } from "@/lib/customer/identity"
import { defaultCountryFromHeaders, normalizePhone } from "@/lib/customer/phone"
import {
  clearCustomerSession,
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  setCustomerSession,
  setPendingPhoneVerification,
} from "@/lib/customer/session"
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

  if (admitted) {
    const verification = await startCustomerPhoneVerification(contact)
    if (verification.status === "unavailable") {
      return {
        fields: { contact },
        errors: {
          form: "We couldn't send a code just now. Try again shortly.",
        },
      }
    }
  }

  try {
    await setPendingPhoneVerification({
      purpose: "wallet",
      phone: contact,
      country: normalized.phone.country,
    })
  } catch (error) {
    logVerificationSendFailure("wallet", error)

    return {
      fields: { contact },
      errors: {
        form: "Verification code could not be sent. Try again shortly.",
      },
    }
  }

  return {
    fields: { contact, otpSent: true },
    message:
      "If a code arrives for that number, enter it here. Otherwise scan a venue QR to join first.",
  }
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
    return {
      fields: { contact },
      message:
        "No cards found for that number yet. Scan a venue QR to join first.",
    }
  }

  await setCustomerSession(customer.id)
  await clearPendingPhoneVerification()
  redirect(next)
}

export async function signOutCustomerAction() {
  await clearCustomerSession()
  redirect("/home/login")
}
