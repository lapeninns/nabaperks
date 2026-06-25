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
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import {
  enforceRateLimit,
  RateLimitError,
  rateLimitIdentityFromHeaders,
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
  const requestIdentity = rateLimitIdentityFromHeaders(requestHeaders)
  const normalized = normalizePhone(rawContact, country)

  if (!normalized.ok) {
    return {
      fields: { contact: rawContact },
      errors: { contact: normalized.error },
    }
  }

  const contact = normalized.phone.e164

  try {
    await enforceRateLimit({
      key: `customer-login:${contact.toLowerCase()}:${requestIdentity}`,
      limit: 5,
      windowMs: 15 * 60_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        fields: { contact },
        errors: { form: "Too many sign-in requests. Try again later." },
      }
    }

    throw error
  }

  const customer = await findCustomerByVerifiedPhone(normalized.phone)

  if (!customer) {
    return {
      fields: { contact, otpSent: true },
      message:
        "If that number has Nabaperks cards, enter the code we sent. Otherwise scan a venue QR to join first.",
    }
  }

  try {
    await startCustomerPhoneVerification(contact)
    await setPendingPhoneVerification({
      purpose: "wallet",
      phone: contact,
      country: normalized.phone.country,
      customerId: customer.id,
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
      "If that number has Nabaperks cards, enter the code we sent. Otherwise scan a venue QR to join first.",
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

  if (!pending.customerId) {
    return {
      fields: { contact, otpSent: true },
      errors: { form: "That code was not accepted." },
    }
  }

  const verification = await checkCustomerPhoneVerification(contact, otp)

  if (verification.status !== "approved") {
    return {
      fields: { contact, otpSent: true },
      errors: { form: "That code was not accepted." },
    }
  }

  await setCustomerSession(pending.customerId)
  await clearPendingPhoneVerification()
  redirect(next)
}

export async function signOutCustomerAction() {
  await clearCustomerSession()
  redirect("/home/login")
}
