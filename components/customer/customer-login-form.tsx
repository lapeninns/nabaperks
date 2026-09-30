"use client"

import { useActionState } from "react"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { submitCustomerLoginOtpAction } from "@/app/home/login/otp-action"
import { ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerLoginEmailStep } from "@/components/customer/customer-login-email-step"
import { CustomerLoginMethodSwitch } from "@/components/customer/customer-login-method-switch"
import { CustomerLoginPhoneStep } from "@/components/customer/customer-login-phone-step"
import { useForgetLegacyContactMethod } from "@/hooks/use-forget-legacy-contact-method"
import { PHONE_CODE_EMAIL_FALLBACK_LABEL } from "@/lib/customer/experience/copy"
import type {
  JoinContactMethod,
  JoinEmailMode,
} from "@/lib/customer/experience/types"
import { LOGIN_COPY, loginHeading } from "@/lib/customer/login-copy"

type LoginAction = (
  state: CustomerLoginOtpState,
  data: FormData
) => Promise<CustomerLoginOtpState>

const EMPTY_STATE: CustomerLoginOtpState = {}

type CustomerLoginFormProps = {
  readonly next: string
  readonly loginAction?: LoginAction
  /**
   * The rollout mode, resolved on the server. `off` shows the phone form
   * alone, as before email sign-in.
   */
  readonly emailMode?: JoinEmailMode
  /**
   * Where the page opens: a wallet phone code still pending opens on its code
   * step (read by the page from the pending cookie), else the number form.
   */
  readonly initialState?: CustomerLoginOtpState
}

/**
 * /home/login ("Open my cards"): opens a guest's cards by mobile number, in
 * the join flow's words. Phone is the only first step. Once email sign-in is
 * on, email is offered only as the code's fallback, as a quiet link: on the
 * phone code step once the server's wait has run, beside a send that failed
 * outright, and on the no-cards step. The server gate
 * (`walletEmailFallbackGate`) refuses email at any other time, whatever the
 * form posts. Once the customer has taken email, the server's answer names
 * it and the screen stays on it.
 */
export function CustomerLoginForm({
  next,
  loginAction = submitCustomerLoginOtpAction,
  emailMode = "off",
  initialState = EMPTY_STATE,
}: CustomerLoginFormProps) {
  const [state, submitAction, pending] = useActionState(
    loginAction,
    initialState
  )
  useForgetLegacyContactMethod()
  const emailEnabled = emailMode !== "off"
  const method: JoinContactMethod = emailEnabled
    ? (state.fields?.method ?? "phone")
    : "phone"
  const step = { state, submitAction, pending, next }
  // Only ever a quiet link: email never competes with the phone as a first
  // choice.
  const emailSwitch = (label: string) =>
    emailEnabled ? (
      <CustomerLoginMethodSwitch
        to="email"
        submitAction={submitAction}
        pending={pending}
        variant="link"
      >
        {label}
      </CustomerLoginMethodSwitch>
    ) : undefined

  return (
    <ReceiptCard edge className="grid min-w-0 gap-6 short:gap-4">
      <LoginHeading state={state} method={method} />

      {method === "email" ? (
        <CustomerLoginEmailStep
          {...step}
          alternate={
            <CustomerLoginMethodSwitch
              to="phone"
              submitAction={submitAction}
              pending={pending}
              variant="link"
            >
              {LOGIN_COPY.backToPhone}
            </CustomerLoginMethodSwitch>
          }
        />
      ) : (
        <CustomerLoginPhoneStep
          {...step}
          // A code that never arrives is why email sign-in exists: the code
          // step offers it once the code has had time to arrive.
          codeAlternate={emailSwitch(PHONE_CODE_EMAIL_FALLBACK_LABEL)}
          // A number with no cards may belong to someone who joined by email.
          scanAlternate={emailSwitch(LOGIN_COPY.emailFallback)}
          // No code went out at all: the code step is never reached.
          sendFailedAlternate={emailSwitch(LOGIN_COPY.emailFallback)}
        />
      )}

      {state.fields?.noCards && !state.fields.editingContact ? null : (
        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          {LOGIN_COPY.newHere}
        </p>
      )}
    </ReceiptCard>
  )
}

function LoginHeading({
  state,
  method,
}: {
  state: CustomerLoginOtpState
  method: JoinContactMethod
}) {
  const editingContact = Boolean(state.fields?.editingContact)
  // A valid code for a number or email with no cards: both methods show the
  // same scan step, not another code.
  const noCards = Boolean(state.fields?.noCards) && !editingContact
  const otpSent = Boolean(state.fields?.otpSent) && !editingContact && !noCards
  const { title, body } = loginHeading({
    method,
    noCards,
    otpSent,
    contact: state.fields?.contact,
    channel: state.fields?.channel,
    maskedEmail: state.fields?.maskedEmail,
  })

  return (
    <div className="grid justify-items-center gap-3 text-center">
      <VenueMark
        size={otpSent ? 40 : 56}
        name="Nabaperks"
        caption="My Nabaperks"
      />
      <div className="grid gap-1">
        <h1 className="text-2xl leading-tight font-extrabold text-balance">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
