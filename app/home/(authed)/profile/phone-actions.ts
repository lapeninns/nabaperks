"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import { normalizeOtpInput } from "@/lib/customer/experience/otp-field"
import {
  attachVerifiedPhoneToCustomer,
  getCurrentCustomer,
} from "@/lib/customer/identity"
import { primaryOtpChannel } from "@/lib/customer/otp-channel-core"
import {
  enforceCustomerOtpSendRateLimit,
  enforceCustomerOtpVerifyRateLimit,
} from "@/lib/customer/otp-rate-limit"
import { defaultCountryFromHeaders, normalizePhone } from "@/lib/customer/phone"
import {
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  setPendingPhoneVerification,
} from "@/lib/customer/session"
import {
  checkCustomerPhoneVerification,
  startCustomerPhoneVerification,
} from "@/lib/customer/verification"
import {
  RateLimitError,
  customerDeviceHashFromHeaders,
  customerRateLimitIdentityFromHeaders,
  trustedClientIp,
} from "@/lib/security/rate-limit"

/**
 * Adding a phone to an email-only wallet from the profile (email sign-in
 * PR 4). Only a signed-in customer whose wallet has no phone gets here. The
 * code goes out under the phone OTP admission with its own `attach` scope,
 * and the pending code is bound to this wallet, so it cannot be spent on
 * another. A phone another wallet holds is refused and nothing changes (D4).
 */

const PROFILE_PATH = "/home/profile"
const SIGN_IN_FIRST = "Sign in to add a phone number."
const SEND_FAILED = "We couldn't send a code just now. Try again shortly."
const CODE_EXPIRED = "Request a new code."
const REQUEST_MESSAGE = "If a code arrives for that number, enter it here."
const ALREADY_HAS_PHONE = "Your wallet already has a phone number."
const ATTACHED = "Your phone number is added. You can sign in with it too."
const CONTACT_CONFLICT =
  "This phone number is already used by another Nabaperks wallet. Sign in with that number, or ask the venue for help."

export type ProfilePhoneState = {
  readonly step: "phone" | "code" | "attached"
  /** The number as typed on the phone step, or E.164 once a code is sent. */
  readonly phone?: string
  readonly errors?: {
    readonly phone?: string
    readonly otp?: string
    readonly form?: string
  }
  readonly message?: string
}

/**
 * One action for the section, chosen by `intent`: `verify` checks a code,
 * `edit` goes back to the number, anything else sends a code.
 */
export async function profilePhoneAction(
  state: ProfilePhoneState,
  formData: FormData
): Promise<ProfilePhoneState> {
  const intent = value(formData, "intent")
  if (intent === "verify") return verifyAttachPhone(formData)
  if (intent === "edit") {
    await clearPendingPhoneVerification()
    return { step: "phone", phone: value(formData, "phone") || state.phone }
  }
  return requestAttachPhone(formData)
}

async function requestAttachPhone(
  formData: FormData
): Promise<ProfilePhoneState> {
  const customer = await getCurrentCustomer()
  if (!customer) return { step: "phone", errors: { form: SIGN_IN_FIRST } }
  if (customer.phoneLast4) {
    return { step: "attached", message: ALREADY_HAS_PHONE }
  }

  const raw = value(formData, "phone")
  const requestHeaders = await headers()
  const normalized = normalizePhone(
    raw,
    defaultCountryFromHeaders(requestHeaders)
  )
  if (!normalized.ok) {
    return { step: "phone", phone: raw, errors: { phone: normalized.error } }
  }

  const phone = normalized.phone
  // Refused admission still sets the pending code, so the answer is the same.
  const admitted = await enforceCustomerOtpSendRateLimit({
    phone: phone.e164,
    requestIdentity: customerRateLimitIdentityFromHeaders(requestHeaders),
    trustedIp: trustedClientIp(requestHeaders),
    scope: "attach",
    deviceHash: customerDeviceHashFromHeaders(requestHeaders),
  })
  let channel = primaryOtpChannel(process.env.CUSTOMER_OTP_PRIMARY_CHANNEL)
  if (admitted) {
    const sent = await startCustomerPhoneVerification(phone.e164, channel)
    if (sent.status === "unavailable") {
      return { step: "phone", phone: raw, errors: { form: SEND_FAILED } }
    }
    channel = sent.channel
  }

  try {
    await setPendingPhoneVerification({
      purpose: "attach",
      phone: phone.e164,
      country: phone.country,
      channel,
      customerId: customer.id,
    })
  } catch {
    return { step: "phone", phone: raw, errors: { form: SEND_FAILED } }
  }

  return { step: "code", phone: phone.e164, message: REQUEST_MESSAGE }
}

async function verifyAttachPhone(
  formData: FormData
): Promise<ProfilePhoneState> {
  const customer = await getCurrentCustomer()
  if (!customer) return { step: "phone", errors: { form: SIGN_IN_FIRST } }

  // Bound to this wallet: a code requested on another wallet, or for joining
  // or signing in, never adds a phone here.
  const pending = await getPendingPhoneVerification()
  if (
    !pending ||
    pending.purpose !== "attach" ||
    pending.customerId !== customer.id
  ) {
    return { step: "phone", errors: { phone: CODE_EXPIRED } }
  }

  const codeStep = { step: "code" as const, phone: pending.phone }
  const otp = normalizeOtpInput(value(formData, "otp"))
  if (!/^\d{4,8}$/.test(otp)) {
    return { ...codeStep, errors: { otp: "Enter the code from your message." } }
  }

  const checked = await checkAttachCode(pending.phone, otp)
  if (checked) return { ...codeStep, errors: checked }

  const result = await attachVerifiedPhoneToCustomer({
    customerId: customer.id,
    phone: {
      e164: pending.phone,
      country: pending.country,
      last4: pending.phone.slice(-4),
    },
  })
  await clearPendingPhoneVerification()

  if (result.status === "contact_conflict") {
    recordCustomerContactEvent({
      eventName: "customer_contact_conflict",
      customerId: customer.id,
      metadata: { method: "phone", surface: "profile", reason: "phone_in_use" },
    })
    return { step: "phone", errors: { form: CONTACT_CONFLICT } }
  }

  revalidatePath(PROFILE_PATH)
  return {
    step: "attached",
    message: result.status === "attached" ? ATTACHED : ALREADY_HAS_PHONE,
  }
}

/** Guess limits, then the provider check. Returns the errors to show, if any. */
async function checkAttachCode(
  phone: string,
  otp: string
): Promise<ProfilePhoneState["errors"] | null> {
  try {
    await enforceCustomerOtpVerifyRateLimit({
      phone,
      requestIdentity: customerRateLimitIdentityFromHeaders(await headers()),
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { form: "Too many code attempts. Request a new code shortly." }
    }
    throw error
  }

  const verification = await checkCustomerPhoneVerification(phone, otp)
  if (verification.status === "unavailable") {
    return {
      form: "We couldn't check that code. Try again or request a new one.",
    }
  }
  if (verification.status === "rejected") {
    return { otp: "That code was not accepted." }
  }
  return null
}

function value(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
