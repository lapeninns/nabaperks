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
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"

export type WalletOtpState = {
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

const NEXT_PATH = "/wallet"

export async function requestWalletOtpAction(
  _state: WalletOtpState,
  formData: FormData
): Promise<WalletOtpState> {
  const rawContact = value(formData, "contact")
  const country = defaultCountryFromHeaders(await headers())
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
      key: `wallet-login:${contact.toLowerCase()}`,
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
      fields: { contact },
      errors: {
        form: "We couldn't find a wallet for that phone. Scan a venue's QR code to join first.",
      },
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
  } catch {
    return {
      fields: { contact },
      errors: {
        form: "Verification code could not be sent. Try again shortly.",
      },
    }
  }

  return {
    fields: { contact, otpSent: true },
    message: "Enter the code we sent to your phone.",
  }
}

export async function verifyWalletOtpAction(
  _state: WalletOtpState,
  formData: FormData
): Promise<WalletOtpState> {
  const otp = value(formData, "otp")
  const pending = await getPendingPhoneVerification()

  if (!pending || pending.purpose !== "wallet" || !pending.customerId) {
    return { errors: { contact: "Request a new phone code." } }
  }

  const contact = pending.phone

  if (!/^\d{4,8}$/.test(otp)) {
    return {
      fields: { contact, otpSent: true },
      errors: { otp: "Enter the verification code." },
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
  redirect(NEXT_PATH)
}

export async function signOutCustomerAction() {
  await clearCustomerSession()
  redirect("/wallet/login")
}
