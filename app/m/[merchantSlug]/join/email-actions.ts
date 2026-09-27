"use server"

import { redirect } from "next/navigation"

import { establishCustomerSessionAfterVerifiedEmail } from "@/lib/customer/access-continuity"
import {
  emailSignInEnabled,
  emailWalletCreationEnabled,
} from "@/lib/customer/email-auth-mode"
import { normalizeEmail } from "@/lib/customer/email-pii-core"
import {
  checkEmailSignInChallenge,
  clearVerifiedEmailHandoff,
  consumeVerifiedEmailHandoff,
  getPendingEmailSignIn,
  readVerifiedEmailHandoff,
  setVerifiedEmailHandoff,
  startEmailSignInChallenge,
} from "@/lib/customer/email-sign-in"
import { normalizeOtpInput } from "@/lib/customer/experience/otp-field"
import {
  createCustomerByVerifiedEmail,
  findCustomerByVerifiedEmail,
  type CurrentCustomer,
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
 * Email on the join page (email sign-in PR 3). The join page is both sign-in
 * and sign-up: a verified email that a wallet already holds opens that wallet;
 * one that no wallet holds leads to an explicit choice, and only the customer's
 * "start a new wallet" (mode `full`) creates one (D2).
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
  "Email sign-in isn't available just now. Use your phone number instead."
const EMAIL_WALLET_CREATION_OFF =
  "You can't start a wallet with email just now. Use your phone number instead."
const EMAIL_DELAYED =
  "Email codes are delayed. Try again shortly or use your phone."
const CARD_UNAVAILABLE = "This loyalty card is unavailable just now."
const HANDOFF_EXPIRED =
  "That email confirmation has expired. Enter your email again."
const SESSION_FAILED = "We couldn't sign you in just now. Try again shortly."

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
    return {
      fields: isResend ? { ...fields, emailOtpSent: true } : fields,
      errors: { form: EMAIL_DELAYED },
    }
  }

  await captureJoinFunnelEvent({
    eventName: "join_email_requested",
    merchantId,
    entry: entryFor(request),
    step: "email",
    method: "email",
  })

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
      errors: { form: "That code has expired. Request a new one." },
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

  const customer = await findCustomerByVerifiedEmail(result.email)
  if (!customer) {
    // Proven, but no wallet holds it: nothing is created until the customer
    // chooses on the next screen.
    try {
      await setVerifiedEmailHandoff({
        email: result.email,
        emailHmac: result.emailHmac,
        merchantSlug,
        qrId: qrId || null,
      })
    } catch {
      logger.error("customer_email_join_handoff_failed", {
        operation: "set_verified_email_handoff",
      })
      return {
        fields: { merchantSlug, qrId },
        errors: { form: SESSION_FAILED },
      }
    }
    await captureJoinFunnelEvent({
      eventName: "join_email_no_wallet",
      scopeKey: merchantSlug,
      entry: entryFor(request),
      step: "email_choice",
      method: "email",
    })
    redirect(joinHref(request, "email_choice"))
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
    return { fields: { merchantSlug, qrId }, errors: { form: SESSION_FAILED } }
  }
  redirect(await destinationAfterSignIn(request, customer.id, false))
}

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
  if (!(await consumeVerifiedEmailHandoff(handoff))) {
    await clearVerifiedEmailHandoff()
    return { errors: { form: HANDOFF_EXPIRED } }
  }

  const resolution = await createCustomerByVerifiedEmail(handoff.email)
  await clearVerifiedEmailHandoff()

  if (
    !(await signInWithVerifiedEmail(resolution.customer, resolution.created))
  ) {
    return { errors: { form: SESSION_FAILED } }
  }

  if (resolution.created) {
    await captureJoinFunnelEvent({
      eventName: "join_new_email_wallet_confirmed",
      merchantId,
      customerId: resolution.customer.id,
      entry: entryFor(request),
      step: "email_choice",
      method: "email",
    })
  }

  redirect(
    await destinationAfterSignIn(
      request,
      resolution.customer.id,
      resolution.created
    )
  )
}

/**
 * "Use my phone instead" from the choice screen: the verified-email handoff is
 * dropped and the phone step opens. While email sign-in is off there is no
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
  step: CustomerJoinStep
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
