"use server"

import { redirect } from "next/navigation"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { establishCustomerSessionAfterVerifiedEmail } from "@/lib/customer/access-continuity"
import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import { emailSignInEnabled } from "@/lib/customer/email-auth-mode"
import {
  openEmailFallback,
  walletEmailFallbackGate,
} from "@/lib/customer/email-fallback"
import { normalizeEmail } from "@/lib/customer/email-pii-core"
import {
  checkEmailSignInChallenge,
  clearPendingEmailSignIn,
  type EmailSignInVerified,
  getPendingEmailSignIn,
  keepEmailSignInForRetry,
  startEmailSignInChallenge,
} from "@/lib/customer/email-sign-in"
import { normalizeOtpInput } from "@/lib/customer/experience/otp-field"
import {
  type CurrentCustomer,
  findCustomerByVerifiedEmail,
} from "@/lib/customer/identity"
import { isEmailAddress } from "@/lib/customer/profile-fields"
import { phoneCodeStepTiming } from "@/lib/customer/phone-code-email-fallback"
import { getPendingPhoneVerification } from "@/lib/customer/session"
import { safeNextPath } from "@/lib/navigation/safe-next-path"
import { logger } from "@/lib/observability/logger"

/**
 * Email at /home/login (email sign-in PR 4). This page only opens a wallet:
 * a verified email that a wallet holds signs in to it, and one that no wallet
 * holds gets the same scan step as a phone with no cards (#387): pointed at a
 * venue QR or the phone, not offered another code. It never creates a
 * wallet; only the join page does, after the customer chooses to (D2).
 *
 * Every action reads the rollout mode on the server and refuses while email
 * sign-in is off, whatever the form posted. Sessions are minted only through
 * `establishCustomerSessionAfterVerifiedEmail`, never directly.
 *
 * A matched code is spent. If the wallet lookup or the session then fails,
 * the same code is restored under a new challenge (as on the join page), so a
 * passing fault never costs the customer their code.
 */

const EMAIL_SIGN_IN_OFF =
  "Email sign-in isn't available just now. Use your phone number instead."
const EMAIL_DELAYED =
  "Email codes are delayed. Try again shortly or use your phone."
const INVALID_EMAIL = "Enter a valid email address."
const CODE_EXPIRED = "Request a new email code."
const SIGN_IN_RETRY =
  "We couldn't sign you in just now. Enter the same code again shortly."
const REQUEST_MESSAGE = "If a code arrives at that address, enter it here."
const RESEND_MESSAGE = "Use the latest code we sent."
const NO_WALLET_MESSAGE =
  "No wallet uses this email yet. Scan a venue QR to join, or sign in with your phone."

type LoginState = CustomerLoginOtpState

export async function requestCustomerLoginEmailAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!emailSignInEnabled()) return emailSignInOff()
  const gate = await walletEmailFallbackGate()
  if (!gate.open) return phoneStep(gate.phoneCode)
  await openEmailFallback("wallet", "opened")

  // A resend goes to the address already in the pending challenge, never to
  // one the form posts.
  const isResend = value(formData, "resend") === "1"
  const pending = isResend ? await getPendingEmailSignIn() : null
  if (isResend && pending?.purpose !== "wallet") {
    return { fields: { method: "email" }, errors: { email: CODE_EXPIRED } }
  }

  const email = normalizeEmail(pending?.email ?? value(formData, "email"))
  if (!isEmailAddress(email)) {
    return {
      fields: { method: "email", email },
      errors: { email: INVALID_EMAIL },
    }
  }

  const result = await startEmailSignInChallenge({ email, purpose: "wallet" })
  if (result.status === "invalid_email") {
    return {
      fields: { method: "email", email },
      errors: { email: INVALID_EMAIL },
    }
  }

  const codeFields = {
    method: "email" as const,
    email,
    otpSent: true,
    maskedEmail: result.maskedEmail,
    retryAt: result.resendAvailableAt,
  }
  // The sign-in module has already recorded the failed send.
  if (result.status === "delivery_failed") {
    return {
      fields: isResend ? codeFields : { method: "email", email },
      errors: { form: EMAIL_DELAYED },
    }
  }

  recordCustomerContactEvent({
    eventName: "customer_login_code_requested",
    metadata: { method: "email", surface: "home_login" },
  })
  return {
    fields: codeFields,
    message: isResend ? RESEND_MESSAGE : REQUEST_MESSAGE,
  }
}

export async function verifyCustomerLoginEmailAction(
  state: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!emailSignInEnabled()) return emailSignInOff()

  const next = safeNextPath(value(formData, "next"))
  const email = state.fields?.email
  const codeFields = {
    method: "email" as const,
    email,
    otpSent: true,
    maskedEmail: state.fields?.maskedEmail,
    retryAt: state.fields?.retryAt,
  }
  const result = await checkEmailSignInChallenge({
    code: normalizeOtpInput(value(formData, "otp")),
    purpose: "wallet",
  })
  if (result.status === "expired") {
    return {
      fields: { method: "email", email },
      errors: { email: CODE_EXPIRED },
    }
  }
  if (result.status === "invalid_code") {
    return {
      fields: codeFields,
      errors: { otp: "That code was not accepted." },
    }
  }
  if (result.status === "rate_limited") {
    return {
      fields: codeFields,
      errors: { form: "Too many code attempts. Request a new code shortly." },
    }
  }

  // The code is spent from here on. If anything below fails, the same code is
  // restored under a new challenge, so the customer can simply try again.
  let customer: CurrentCustomer | null
  try {
    customer = await findCustomerByVerifiedEmail(result.email)
  } catch {
    return retryVerifiedCode(result, codeFields, "find_customer")
  }

  // Said only now, after the customer proved the inbox is theirs.
  if (!customer) {
    recordCustomerContactEvent({
      eventName: "customer_login_no_wallet",
      metadata: { method: "email", surface: "home_login" },
    })
    // A scan step, not another code, as for a phone with no cards.
    return {
      fields: { method: "email", email, noCards: true },
      message: NO_WALLET_MESSAGE,
    }
  }

  try {
    await establishCustomerSessionAfterVerifiedEmail({
      customer,
      customerWasCreated: false,
    })
  } catch {
    return retryVerifiedCode(result, codeFields, "establish_session")
  }

  recordCustomerContactEvent({
    eventName: "customer_login_verified",
    customerId: customer.id,
    metadata: { method: "email", surface: "home_login" },
  })
  redirect(next)
}

/** "Wrong email? Use a different one": drop the pending code, refill the field. */
export async function editCustomerLoginEmailAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!emailSignInEnabled()) return emailSignInOff()
  const gate = await walletEmailFallbackGate()
  if (!gate.open) return phoneStep(gate.phoneCode)
  // Email stays open for the next address once this code is dropped.
  await openEmailFallback("wallet", "opened")

  await clearPendingEmailSignIn()
  return {
    fields: {
      method: "email",
      email: value(formData, "email"),
      editingContact: true,
    },
  }
}

/**
 * Switches the screen to the other method. Email opens only as the phone's
 * fallback, which the server checks (lib/customer/email-fallback.ts): 30
 * seconds after the latest phone code, after a send that failed, or from the
 * no-cards step; asked for early, the answer is the phone step. Taking the
 * email fallback keeps the phone code pending: a late code is the usual
 * reason to come back, so "Use my phone number instead" returns to that code
 * step while it is still valid. Only an email code actually on its way drops
 * it (`startEmailSignInChallenge`), so one sign-in stays live per browser.
 * Leaving email drops its pending code. While email sign-in is off only the
 * phone is offered.
 */
export async function switchCustomerLoginMethodAction(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!emailSignInEnabled()) return { fields: { method: "phone" } }

  if (value(formData, "method") === "email") {
    const gate = await walletEmailFallbackGate()
    if (!gate.open) return phoneStep(gate.phoneCode)
    await openEmailFallback("wallet", "opened")
    return { fields: { method: "email" } }
  }
  await clearPendingEmailSignIn()
  const phoneCode = await getPendingPhoneVerification()
  return phoneStep(phoneCode?.purpose === "wallet" ? phoneCode : null)
}

/**
 * The phone step: the code step, with the server's wait, while a wallet phone
 * code is pending, else the number form. The same answer whatever address a
 * refused email request named.
 */
function phoneStep(
  phoneCode: { readonly phone: string; readonly issuedAt: number } | null
): LoginState {
  if (!phoneCode) return { fields: { method: "phone" } }
  return {
    fields: {
      method: "phone",
      contact: phoneCode.phone,
      otpSent: true,
      ...phoneCodeStepTiming(phoneCode.issuedAt, Date.now()),
    },
  }
}

/**
 * After a matched code, a failed lookup or session restores the same code
 * under a new challenge and keeps the customer on the code step.
 */
async function retryVerifiedCode(
  verified: EmailSignInVerified,
  fields: NonNullable<LoginState["fields"]>,
  operation: string
): Promise<LoginState> {
  logger.error("customer_email_login_sign_in_failed", { operation })
  await keepEmailSignInForRetry(verified)
  return { fields, errors: { form: SIGN_IN_RETRY } }
}

function emailSignInOff(): LoginState {
  return { fields: { method: "phone" }, errors: { form: EMAIL_SIGN_IN_OFF } }
}

function value(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
