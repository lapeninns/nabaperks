"use client"

import { useActionState } from "react"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { submitCustomerLoginOtpAction } from "@/app/home/login/otp-action"
import { ReceiptCard, VenueMark } from "@/components/brand"
import {
  ContactMethodOrder,
  useRememberContactMethodOnVerify,
} from "@/components/customer/contact-method-order"
import { CustomerLoginEmailStep } from "@/components/customer/customer-login-email-step"
import {
  CustomerLoginMethodSwitch,
  type CustomerLoginStepProps,
} from "@/components/customer/customer-login-method-switch"
import { CustomerLoginPhoneStep } from "@/components/customer/customer-login-phone-step"
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
 * /home/login: opens an existing wallet by phone or, once email sign-in is on,
 * by email. In mode `full` email leads and in `existing` phone leads, unless
 * this device last verified with the other method (D12); the other method is
 * always one visible button away. Once the customer has used or picked a
 * method, the server's answer names it and the screen stays on it.
 */
export function CustomerLoginForm({
  next,
  loginAction = submitCustomerLoginOtpAction,
  emailMode = "off",
}: CustomerLoginFormProps) {
  const [state, submitAction, pending] = useActionState(loginAction, {})
  const emailEnabled = emailMode !== "off"
  const method: JoinContactMethod | undefined = emailEnabled
    ? state.fields?.method
    : "phone"
  const editingContact = Boolean(state.fields?.editingContact)
  // A valid code for a number or email with no cards: both methods show the
  // same scan step, not another code.
  const noCards = Boolean(state.fields?.noCards) && !editingContact
  const otpSent = Boolean(state.fields?.otpSent) && !editingContact && !noCards
  // A sign-in here makes the join page lead with that method next time (D12).
  const rememberPhone = useRememberContactMethodOnVerify("phone", state)
  const rememberEmail = useRememberContactMethodOnVerify("email", state)
  const step: Omit<CustomerLoginStepProps, "onVerifySubmit"> = {
    state,
    submitAction,
    pending,
    next,
  }

  const phone = (
    <CustomerLoginPhoneStep
      {...step}
      onVerifySubmit={rememberPhone}
      alternate={
        emailEnabled ? (
          <CustomerLoginMethodSwitch
            to="email"
            submitAction={submitAction}
            pending={pending}
          >
            Use my email instead
          </CustomerLoginMethodSwitch>
        ) : undefined
      }
      // A text that never arrives is why email sign-in exists, so the code
      // step offers email too, as the email code step offers phone.
      codeAlternate={
        emailEnabled ? (
          <CustomerLoginMethodSwitch
            to="email"
            submitAction={submitAction}
            pending={pending}
            variant="link"
          >
            Use my email instead
          </CustomerLoginMethodSwitch>
        ) : undefined
      }
    />
  )
  const email = (
    <CustomerLoginEmailStep
      {...step}
      onVerifySubmit={rememberEmail}
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
  )

  return (
    <ReceiptCard edge className="grid min-w-0 gap-6 short:gap-4">
      <div className="grid justify-items-center gap-3 text-center">
        <VenueMark
          size={otpSent ? 40 : 56}
          name="Nabaperks"
          caption="My Nabaperks"
        />
        <div className="grid gap-1">
          <h1 className="text-2xl leading-tight font-extrabold text-balance">
            {noCards
              ? `No cards on this ${method === "email" ? "email" : "number"}`
              : otpSent
                ? "Enter your code"
                : "Welcome back"}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {noCards
              ? "Scan the venue QR at the counter. Your first card is created there."
              : otpSent
                ? `Use the code from your ${method === "email" ? "email" : "message"} to open your cards.`
                : "Sign in to see every loyalty card you've collected, track your rewards, and pick up where you left off."}
          </p>
        </div>
      </div>

      {method === "email" ? (
        email
      ) : method === "phone" ? (
        phone
      ) : (
        <ContactMethodOrder
          defaultMethod={emailMode === "full" ? "email" : "phone"}
          email={email}
          phone={phone}
        />
      )}

      {noCards ? null : (
        <p className="border-t-2 border-ink/15 pt-4 text-center text-sm leading-6 text-muted-foreground">
          New here? Scan a venue&apos;s QR code to collect your first stamp —
          your first card is created automatically.
        </p>
      )}
    </ReceiptCard>
  )
}
