"use client"

import { useActionState } from "react"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { submitCustomerLoginOtpAction } from "@/app/home/login/otp-action"
import { ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerLoginEmailStep } from "@/components/customer/customer-login-email-step"
import { CustomerLoginMethodSwitch } from "@/components/customer/customer-login-method-switch"
import { CustomerLoginPhoneStep } from "@/components/customer/customer-login-phone-step"
import {
  JOIN_EMAIL_FALLBACK_HEADLINE,
  PHONE_CODE_EMAIL_FALLBACK_LABEL,
} from "@/lib/customer/experience/copy"
import type {
  JoinContactMethod,
  JoinEmailMode,
} from "@/lib/customer/experience/types"

type LoginAction = (
  state: CustomerLoginOtpState,
  data: FormData
) => Promise<CustomerLoginOtpState>

type CustomerLoginFormProps = {
  readonly next: string
  readonly loginAction?: LoginAction
  /**
   * The rollout mode, resolved on the server. `off` shows the phone form
   * alone, as before email sign-in.
   */
  readonly emailMode?: JoinEmailMode
}

/**
 * /home/login: opens an existing wallet by phone. Phone is always the first
 * and only contact form; once email sign-in is on, the phone code step offers
 * email as a fallback when the text has not arrived 30 seconds after it was
 * sent. Once the customer has picked email, the server's answer names it and
 * the screen stays on it.
 */
export function CustomerLoginForm({
  next,
  loginAction = submitCustomerLoginOtpAction,
  emailMode = "off",
}: CustomerLoginFormProps) {
  const [state, submitAction, pending] = useActionState(loginAction, {})
  const emailEnabled = emailMode !== "off"
  const method: JoinContactMethod = emailEnabled
    ? (state.fields?.method ?? "phone")
    : "phone"
  const step = { state, submitAction, pending, next }
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
            >
              Use my phone number instead
            </CustomerLoginMethodSwitch>
          }
        />
      ) : (
        <CustomerLoginPhoneStep
          {...step}
          // A text that never arrives is why email sign-in exists: the code
          // step offers it once the text has had time to arrive.
          codeAlternate={emailSwitch(PHONE_CODE_EMAIL_FALLBACK_LABEL)}
          // A number with no cards may belong to someone who joined by email.
          scanAlternate={emailSwitch("Use my email instead")}
        />
      )}

      {state.fields?.noCards && !state.fields.editingContact ? null : (
        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp —
          your first card is created automatically.
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
  const byEmail = method === "email"
  const title = noCards
    ? `No cards on this ${byEmail ? "email" : "number"}`
    : otpSent
      ? "Enter your code"
      : byEmail
        ? JOIN_EMAIL_FALLBACK_HEADLINE
        : "Welcome back"
  const body = noCards
    ? "Scan the venue QR at the counter. Your first card is created there."
    : otpSent
      ? `Use the code from your ${byEmail ? "email" : "message"} to open your cards.`
      : byEmail
        ? "We'll email you a one-time code to open your cards."
        : "Sign in to see every loyalty card you've collected, track your rewards, and pick up where you left off."

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
