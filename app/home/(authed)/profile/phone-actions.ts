"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import { normalizeOtpInput } from "@/lib/customer/experience/otp-field"
import { customerHasVerifiedPhone } from "@/lib/customer/phone-verification-state"
import {
  attachVerifiedPhoneToCustomer,
  getCurrentCustomer,
} from "@/lib/customer/identity"
import {
  parseOtpChannel,
  primaryOtpChannel,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
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
 * Adding or recovering an unverified phone from Profile or reward collection.
 * Only a signed-in customer without a verified phone gets here. The
 * code goes out under the phone OTP admission with its own `attach` scope,
 * and the pending code is bound to this wallet, so it cannot be spent on
 * another. A phone another wallet holds is refused and nothing changes (D4).
 *
 * Deliberately not gated on CUSTOMER_EMAIL_AUTH_MODE, unlike the email
 * sign-in actions. Adding a phone uses the phone sign-in that exists in every
 * mode, and it is how an email-only wallet keeps a way back in when email
 * sign-in is switched `off` as a kill switch. The session, the `attach`
 * purpose and the wallet binding are the gates here.
 */

const PROFILE_PATH = "/home/profile"
const SIGN_IN_FIRST = "Sign in to add a phone number."
const SEND_FAILED = "We couldn't send a code just now. Try again shortly."
const CODE_EXPIRED = "Request a new code."
const REQUEST_MESSAGE = "If a code arrives for that number, enter it here."
const ALREADY_HAS_PHONE = "Your wallet already has a phone number."
const ATTACHED = "Your phone number is added. You can sign in with it too."
const ADD_FAILED =
  "We couldn't add this phone number just now. Try again shortly."
const CONTACT_CONFLICT =
  "This phone number is already used by another Nabaperks wallet. Sign in with that number, or ask the venue for help."

export type ProfilePhoneState = {
  readonly step: "phone" | "code" | "attached"
  /** The number as typed on the phone step, or E.164 once a code is sent. */
  readonly phone?: string
  /** The channel that carried the code, so the code step can offer a text. */
  readonly channel?: OtpChannel
  readonly errors?: {
    readonly phone?: string
    readonly otp?: string
    readonly form?: string
  }
  readonly message?: string
}

/**
 * One action for the section, chosen by `intent`: `verify` checks a code,
 * `edit` goes back to the number, anything else sends a code. A send marked
 * `resend` reuses the pending number and, unless the form names another
 * channel ("Text me instead"), the channel that carried the last code.
 */
export async function profilePhoneAction(
  state: ProfilePhoneState,
  formData: FormData
): Promise<ProfilePhoneState> {
  return phoneAction(state, formData, "profile")
}

export async function rewardPhoneAction(
  state: ProfilePhoneState,
  formData: FormData
): Promise<ProfilePhoneState> {
  return phoneAction(state, formData, "reward_gate")
}

async function phoneAction(
  state: ProfilePhoneState,
  formData: FormData,
  surface: "profile" | "reward_gate"
): Promise<ProfilePhoneState> {
  const intent = value(formData, "intent")
  if (intent === "verify") return verifyAttachPhone(formData, surface)
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
  if (await customerHasVerifiedPhone(customer.id)) {
    return { step: "attached", message: ALREADY_HAS_PHONE }
  }

  const raw = value(formData, "phone")
  const requestHeaders = await headers()
  const resent = await pendingAttachFor(customer.id, formData)
  const normalized = resent
    ? ({ ok: true, phone: resent } as const)
    : normalizePhone(raw, defaultCountryFromHeaders(requestHeaders))
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
  let channel =
    parseOtpChannel(value(formData, "channel")) ??
    resent?.channel ??
    primaryOtpChannel(process.env.CUSTOMER_OTP_PRIMARY_CHANNEL)
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

  return { step: "code", phone: phone.e164, channel, message: REQUEST_MESSAGE }
}

/** This wallet's pending attach code, when the form asks to resend it. */
async function pendingAttachFor(
  customerId: string,
  formData: FormData
): Promise<{ e164: string; country: string; channel?: OtpChannel } | null> {
  if (value(formData, "resend") !== "1") return null
  const pending = await getPendingPhoneVerification()
  if (pending?.purpose !== "attach" || pending.customerId !== customerId) {
    return null
  }
  return {
    e164: pending.phone,
    country: pending.country,
    ...(pending.channel ? { channel: pending.channel } : {}),
  }
}

async function verifyAttachPhone(
  formData: FormData,
  surface: "profile" | "reward_gate"
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

  const codeStep = {
    step: "code" as const,
    phone: pending.phone,
    ...(pending.channel ? { channel: pending.channel } : {}),
  }
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
    surface,
  })
  await clearPendingPhoneVerification()

  // The phone was taken off again because its audit row could not be
  // written; the code is spent, so the customer starts over.
  if (result.status === "audit_failed") {
    return { step: "phone", phone: pending.phone, errors: { form: ADD_FAILED } }
  }
  if (result.status === "contact_conflict") {
    recordCustomerContactEvent({
      eventName: "customer_contact_conflict",
      customerId: customer.id,
      metadata: { method: "phone", surface, reason: "phone_in_use" },
    })
    return { step: "phone", errors: { form: CONTACT_CONFLICT } }
  }

  revalidatePath(PROFILE_PATH)
  revalidatePath("/reward", "layout")
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
