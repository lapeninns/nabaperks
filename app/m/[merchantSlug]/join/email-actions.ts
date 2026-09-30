"use server"

import { redirect } from "next/navigation"

import { establishCustomerSessionAfterVerifiedEmail } from "@/lib/customer/access-continuity"
import {
  emailSignInEnabled,
  emailWalletCreationEnabled,
} from "@/lib/customer/email-auth-mode"
import { joinEmailFallbackGate } from "@/lib/customer/email-fallback"
import { normalizeEmail } from "@/lib/customer/email-pii-core"
import {
  checkEmailSignInChallenge,
  clearVerifiedEmailHandoff,
  consumeVerifiedEmailHandoff,
  getPendingEmailSignIn,
  keepEmailSignInForRetry,
  readVerifiedEmailHandoff,
  reissueVerifiedEmailHandoff,
  setVerifiedEmailHandoff,
  startEmailSignInChallenge,
  type EmailSignInVerified,
} from "@/lib/customer/email-sign-in"
import type { VerifiedEmailHandoffPayload } from "@/lib/customer/email-sign-in-core"
import { JOIN_EMAIL_DELAYED } from "@/lib/customer/experience/copy"
import { normalizeOtpInput } from "@/lib/customer/experience/otp-field"
import {
  createCustomerByVerifiedEmail,
  findCustomerByVerifiedEmail,
  type CurrentCustomer,
  type VerifiedEmailWallet,
} from "@/lib/customer/identity"
import { getMerchantJoinContext } from "@/lib/customer/join"
import { captureJoinFunnelEvent } from "@/lib/customer/join-funnel"
import { joinEntry } from "@/lib/customer/join-observability-contract"
import { isEmailAddress } from "@/lib/customer/profile-fields"
import { destinationForReturningQrVisit } from "@/lib/customer/returning-qr-redirect"
import {
  buildCustomerJoinHref,
  type CustomerJoinStep,
} from "@/lib/navigation/customer-join-intent"
import { logger } from "@/lib/observability/logger"

import { formValue } from "./form-values"

/**
 * Email on the join page, only ever as the phone code's fallback. After a
 * valid code the server decides; the guest is never asked to choose again:
 *
 * - a wallet holds the verified email: signed in, then today's stamp or the
 *   terms step, as on the phone path;
 * - none does, mode `full`: a wallet is created from the verified email at
 *   this step (as a verified phone creates one), signed in, then terms. No
 *   membership, stamp or consent exists until the guest accepts the terms;
 * - none does, mode `existing`: a bound handoff records the proof and the
 *   page says no card uses this email, with the way back to the phone.
 *
 * A handoff cookie left by the previous build (which asked the guest to
 * choose) is still honoured by `startEmailWalletAction`, single use as before.
 *
 * Every action reads the rollout mode on the server and refuses while email
 * sign-in is off, whatever the form posted. Sessions are minted only through
 * `establishCustomerSessionAfterVerifiedEmail`, never directly.
 */

export type CustomerEmailIdentityState = {
  fields?: {
    email?: string
    merchantSlug?: string
    qrId?: string
    emailOtpSent?: boolean
    /** Epoch seconds when the next resend is allowed. */
    resendAvailableAt?: number
  }
  errors?: {
    email?: string
    otp?: string
    form?: string
  }
  message?: string
}

export type CustomerEmailChoiceState = {
  errors?: {
    form?: string
  }
}

type JoinRequest = {
  merchantSlug: string
  qrId: string
  ref: string
}

const EMAIL_SIGN_IN_OFF =
  "Codes by email aren't available just now. Use your mobile number instead."
const EMAIL_WALLET_CREATION_OFF =
  "You can't join with email just now. Use your mobile number instead."
const CARD_UNAVAILABLE = "This loyalty card is unavailable just now."
const HANDOFF_EXPIRED =
  "That email confirmation has expired. Enter your email again."
const SESSION_FAILED = "We couldn't sign you in just now. Try again shortly."
const SIGN_IN_RETRY =
  "We couldn't finish signing you in. Enter the same code again."
const WALLET_RETRY = "We couldn't set up your card just now. Try again shortly."
/** Never says what holds the address or what it holds (no enumeration). */
const EMAIL_HELD_ELSEWHERE =
  "This email is used by another Nabaperks card. Use your mobile number instead, or ask the venue team for help."

export async function requestCustomerEmailIdentityAction(
  _state: CustomerEmailIdentityState,
  formData: FormData
): Promise<CustomerEmailIdentityState> {
  const request = joinRequest(formData)
  const { merchantSlug, qrId } = request
  if (!emailSignInEnabled()) {
    return {
      fields: { merchantSlug, qrId },
      errors: { form: EMAIL_SIGN_IN_OFF },
    }
  }

  // Phone first: email is only the phone code's fallback. A request made
  // before the server opens it goes back to the phone step (the code still
  // pending, if there is one), whatever address it names.
  const gate = await joinEmailFallbackGate({ merchantSlug, qrId })
  if (!gate.open)
    redirect(joinHref(request, gate.phoneCode ? undefined : "phone"))

  // A resend goes to the address already in the pending challenge, never to
  // one the form posts.
  const isResend = formValue(formData, "resend") === "1"
  const pending = isResend ? await getPendingEmailSignIn() : null
  if (isResend && pending?.purpose !== "join") {
    return {
      fields: { merchantSlug, qrId },
      errors: { form: "That code has expired. Enter your email again." },
    }
  }

  const email = normalizeEmail(pending?.email ?? formValue(formData, "email"))
  const fields = { ...(!isResend ? { email } : {}), merchantSlug, qrId }
  if (!isEmailAddress(email)) {
    return { fields, errors: { email: "Enter a valid email address." } }
  }

  const merchantId = await availableJoinMerchantId(merchantSlug, qrId)
  if (!merchantId) return { fields, errors: { form: CARD_UNAVAILABLE } }

  const result = await startEmailSignInChallenge({
    email,
    purpose: "join",
    merchantId,
  })
  if (result.status === "invalid_email") {
    return { fields, errors: { email: "Enter a valid email address." } }
  }
  if (result.status === "delivery_failed") {
    // The failed send renewed the cooldown; the code step counts down to it.
    return {
      fields: isResend
        ? {
            ...fields,
            emailOtpSent: true,
            resendAvailableAt: result.resendAvailableAt,
          }
        : fields,
      errors: { form: JOIN_EMAIL_DELAYED },
    }
  }

  // Counted only when a new code was admitted. A refused (held) send looks
  // the same to the guest (D8) and the sign-in module tracks it as a failed
  // send; a repeat is the request already counted (QA BUG-026).
  if (result.admission === "admitted") {
    await captureJoinFunnelEvent({
      eventName: "join_email_requested",
      merchantId,
      entry: entryFor(request),
      step: "email",
      method: "email",
    })
  }

  // A resend from the code step answers in place, like the phone resend.
  if (isResend) {
    return {
      fields: {
        merchantSlug,
        qrId,
        emailOtpSent: true,
        resendAvailableAt: result.resendAvailableAt,
      },
      message: "Use the latest code we sent.",
    }
  }

  redirect(joinHref(request, "otp"))
}

export async function verifyCustomerEmailOtpAction(
  _state: CustomerEmailIdentityState,
  formData: FormData
): Promise<CustomerEmailIdentityState> {
  const request = joinRequest(formData)
  const { merchantSlug, qrId } = request
  if (!emailSignInEnabled()) {
    return {
      fields: { merchantSlug, qrId },
      errors: { form: EMAIL_SIGN_IN_OFF },
    }
  }

  const codeFields = { merchantSlug, qrId, emailOtpSent: true }
  const result = await checkEmailSignInChallenge({
    code: normalizeOtpInput(formValue(formData, "otp")),
    purpose: "join",
  })
  if (result.status === "expired") {
    return {
      fields: { merchantSlug, qrId },
      errors: { form: "That code has expired. Send a new code." },
    }
  }
  if (result.status === "invalid_code") {
    return {
      fields: codeFields,
      errors: { otp: "That code didn't work. Check it and try again." },
    }
  }
  if (result.status === "rate_limited") {
    return {
      fields: codeFields,
      errors: { form: "Too many tries. Send a new code in a few minutes." },
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

  if (!customer) {
    return emailWalletCreationEnabled()
      ? startWalletFromVerifiedCode(request, result, codeFields)
      : noCardForVerifiedEmail(request, result, codeFields)
  }

  await captureJoinFunnelEvent({
    eventName: "join_otp_verified",
    customerId: customer.id,
    scopeKey: merchantSlug,
    entry: entryFor(request),
    step: "otp",
    method: "email",
  })

  if (!(await signInWithVerifiedEmail(customer, false))) {
    return retryVerifiedCode(result, codeFields, "establish_session")
  }
  redirect(await destinationAfterSignIn(request, customer.id, false))
}

type CodeFields = NonNullable<CustomerEmailIdentityState["fields"]>

/**
 * Mode `full`, no wallet holds the verified email: create one here, as the
 * phone path does for a verified phone, and continue to the terms step. The
 * code is spent, so a failure restores it for one more try; a retry then
 * finds the wallet the first try made and signs in to it.
 */
async function startWalletFromVerifiedCode(
  request: JoinRequest,
  verified: EmailSignInVerified,
  codeFields: CodeFields
): Promise<CustomerEmailIdentityState> {
  const merchantId = await availableJoinMerchantId(
    request.merchantSlug,
    request.qrId
  )
  if (!merchantId) {
    await keepEmailSignInForRetry(verified)
    return { fields: codeFields, errors: { form: CARD_UNAVAILABLE } }
  }

  let wallet: VerifiedEmailWallet
  try {
    wallet = await createCustomerByVerifiedEmail(verified.email)
  } catch {
    return retryVerifiedCode(verified, codeFields, "create_customer")
  }

  if (wallet.status === "conflict") {
    // Another wallet holds the address without a verified match. Nothing is
    // created or signed in, and nothing about that wallet is said.
    logger.warn("customer_email_join_wallet_conflict", {
      operation: "create_customer",
    })
    return { fields: codeFields, errors: { form: EMAIL_HELD_ELSEWHERE } }
  }

  // The verified email is this journey's verification, recorded as the
  // previous build recorded it once the guest chose email (QA BUG-028). A
  // retry after a failed session is deduplicated by the funnel's event ID.
  await captureJoinFunnelEvent({
    eventName: "join_otp_verified",
    customerId: wallet.customer.id,
    scopeKey: request.merchantSlug,
    entry: entryFor(request),
    step: "otp",
    method: "email",
  })
  const created = wallet.status === "created"
  if (created) {
    await captureJoinFunnelEvent({
      eventName: "join_new_email_wallet_confirmed",
      merchantId,
      customerId: wallet.customer.id,
      entry: entryFor(request),
      step: "email_choice",
      method: "email",
    })
  }

  if (!(await signInWithVerifiedEmail(wallet.customer, created))) {
    return retryVerifiedCode(verified, codeFields, "establish_session")
  }
  redirect(await destinationAfterSignIn(request, wallet.customer.id, created))
}

/**
 * Mode `existing`, no wallet holds the verified email: nothing is created. A
 * handoff bound to this device, venue and QR records the proof, and the page
 * says no card uses this email, with one action back to the phone.
 */
async function noCardForVerifiedEmail(
  request: JoinRequest,
  verified: EmailSignInVerified,
  codeFields: CodeFields
): Promise<CustomerEmailIdentityState> {
  try {
    await setVerifiedEmailHandoff({
      email: verified.email,
      emailHmac: verified.emailHmac,
      merchantSlug: request.merchantSlug,
      qrId: request.qrId || null,
    })
  } catch {
    return retryVerifiedCode(verified, codeFields, "set_verified_email_handoff")
  }
  await captureJoinFunnelEvent({
    eventName: "join_email_no_wallet",
    scopeKey: request.merchantSlug,
    entry: entryFor(request),
    step: "email_choice",
    method: "email",
  })
  redirect(joinHref(request, "email_choice"))
}

/**
 * "Continue" on a confirmed-email handoff left by the previous build, which
 * asked the guest to choose after the code. Mode `full` only; the handoff is
 * spent once on the server, as before.
 */
export async function startEmailWalletAction(
  _state: CustomerEmailChoiceState,
  formData: FormData
): Promise<CustomerEmailChoiceState> {
  const request = joinRequest(formData)
  if (!emailSignInEnabled() || !emailWalletCreationEnabled()) {
    return { errors: { form: EMAIL_WALLET_CREATION_OFF } }
  }

  const handoff = await readVerifiedEmailHandoff({
    merchantSlug: request.merchantSlug,
    qrId: request.qrId,
  })
  if (!handoff) return { errors: { form: HANDOFF_EXPIRED } }

  const merchantId = await availableJoinMerchantId(
    request.merchantSlug,
    request.qrId
  )
  if (!merchantId) return { errors: { form: CARD_UNAVAILABLE } }

  // Single use on the server, not only in this browser: a replayed copy of
  // the cookie must not sign in to the wallet the first use created.
  // The refusal leaves the cookie alone: deleting it here refreshes the page
  // to the welcome step and the guest never sees why (QA BUG-017). The spent
  // copy keeps the choice screen, which shows this message and offers a
  // different email or the phone, and it can never be spent again.
  if (!(await consumeVerifiedEmailHandoff(handoff))) {
    return { errors: { form: HANDOFF_EXPIRED } }
  }

  // The handoff is spent from here on. A failure below re-issues it under a
  // new ID, so a retry works and a copy of the spent one still does not.
  let wallet: VerifiedEmailWallet
  try {
    wallet = await createCustomerByVerifiedEmail(handoff.email)
  } catch {
    logger.error("customer_email_join_wallet_failed", {
      operation: "create_customer",
    })
    return retryWalletStart(handoff, WALLET_RETRY)
  }

  if (wallet.status === "conflict") {
    await clearVerifiedEmailHandoff()
    logger.warn("customer_email_join_wallet_conflict", {
      operation: "create_customer",
    })
    return { errors: { form: EMAIL_HELD_ELSEWHERE } }
  }

  // The legacy handoff's code step recorded nothing, so the verification is
  // recorded here (QA BUG-028). A retry after a failed session is
  // deduplicated by the funnel's event ID.
  await captureJoinFunnelEvent({
    eventName: "join_otp_verified",
    customerId: wallet.customer.id,
    scopeKey: request.merchantSlug,
    entry: entryFor(request),
    step: "otp",
    method: "email",
  })

  const created = wallet.status === "created"
  if (created) {
    await captureJoinFunnelEvent({
      eventName: "join_new_email_wallet_confirmed",
      merchantId,
      customerId: wallet.customer.id,
      entry: entryFor(request),
      step: "email_choice",
      method: "email",
    })
  }

  // A retry after a failed session finds the wallet made on the first try
  // (`existing`) and signs in to it as a verified email.
  if (!(await signInWithVerifiedEmail(wallet.customer, created))) {
    return retryWalletStart(handoff, SESSION_FAILED)
  }
  await clearVerifiedEmailHandoff()

  redirect(await destinationAfterSignIn(request, wallet.customer.id, created))
}

/**
 * "Use my mobile number" from the confirmed-email screens: the verified-email
 * handoff is dropped and the phone step opens. While email sign-in is off there is no
 * handoff to drop, so it only opens the phone step.
 */
export async function switchJoinToPhoneAction(
  formData: FormData
): Promise<void> {
  const request = joinRequest(formData)
  if (emailSignInEnabled()) {
    await clearVerifiedEmailHandoff()
  }
  redirect(joinHref(request, "phone"))
}

function joinRequest(formData: FormData): JoinRequest {
  return {
    merchantSlug: formValue(formData, "merchantSlug"),
    qrId: formValue(formData, "qrId"),
    ref: formValue(formData, "ref"),
  }
}

function entryFor({ qrId, ref }: JoinRequest) {
  return joinEntry({ qrId, referralCode: ref })
}

function joinHref(
  { merchantSlug, qrId, ref }: JoinRequest,
  step: CustomerJoinStep | undefined
): string {
  return buildCustomerJoinHref(merchantSlug, {
    qrId: qrId || undefined,
    referralCode: ref || undefined,
    step,
  })
}

async function availableJoinMerchantId(
  merchantSlug: string,
  qrId: string
): Promise<string | null> {
  try {
    const context = await getMerchantJoinContext(
      merchantSlug,
      qrId || undefined
    )
    return context?.available ? context.merchant.id : null
  } catch {
    logger.error("customer_join_otp_context_failed", {
      operation: "validate_before_email_otp_send",
      reason: "join_context_unavailable",
    })
    return null
  }
}

/**
 * After a matched code, a failed lookup, wallet, handoff or session restores
 * the same code under a new challenge and keeps the customer on the code step.
 */
async function retryVerifiedCode(
  verified: EmailSignInVerified,
  fields: CodeFields,
  operation: string
): Promise<CustomerEmailIdentityState> {
  logger.error("customer_email_join_sign_in_failed", { operation })
  await keepEmailSignInForRetry(verified)
  return { fields, errors: { form: SIGN_IN_RETRY } }
}

/** A spent handoff whose wallet start failed, re-issued for one more try. */
async function retryWalletStart(
  spent: VerifiedEmailHandoffPayload,
  message: string
): Promise<CustomerEmailChoiceState> {
  if (!(await reissueVerifiedEmailHandoff(spent))) {
    await clearVerifiedEmailHandoff()
    return { errors: { form: HANDOFF_EXPIRED } }
  }
  return { errors: { form: message } }
}

async function signInWithVerifiedEmail(
  customer: CurrentCustomer,
  customerWasCreated: boolean
): Promise<boolean> {
  try {
    await establishCustomerSessionAfterVerifiedEmail({
      customer,
      customerWasCreated,
    })
    return true
  } catch {
    logger.error("customer_email_join_session_failed", {
      operation: "establish_session",
    })
    return false
  }
}

/**
 * Same routing as the phone path: an existing member who scanned a venue QR
 * goes straight to today's stamp; everyone else continues to the terms step.
 * A wallet created seconds ago cannot hold a card here yet.
 */
async function destinationAfterSignIn(
  request: JoinRequest,
  customerId: string,
  customerWasCreated: boolean
): Promise<string> {
  if (request.qrId && !customerWasCreated) {
    const destination = await destinationForReturningQrVisit(
      request.merchantSlug,
      request.qrId,
      customerId
    )
    if (destination) return destination
  }
  return joinHref(request, "terms")
}
