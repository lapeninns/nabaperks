"use client"

import type { ReactNode } from "react"

import type { CustomerLoginOtpState } from "@/app/home/actions"
import { SubmitButton } from "@/components/forms"
import type { JoinContactMethod } from "@/lib/customer/experience/types"

/** What each /home/login step receives from the one login form state. */
export type CustomerLoginStepProps = {
  readonly state: CustomerLoginOtpState
  readonly submitAction: (data: FormData) => void
  readonly pending: boolean
  readonly next: string
  /** Email step: the phone, directly under the step's own button. */
  readonly alternate?: ReactNode
  /**
   * Phone code step: email beside "Resend code", for a customer whose code
   * has not arrived. Shown only once the send is 30 seconds old; absent
   * while email sign-in is off.
   */
  readonly codeAlternate?: ReactNode
  /** Phone scan step (no cards on the number): email, for a card joined by email. */
  readonly scanAlternate?: ReactNode
  /**
   * Phone number step, only after no code could be sent: email beside the
   * error. Absent while email sign-in is off.
   */
  readonly sendFailedAlternate?: ReactNode
}

/**
 * Switches /home/login between phone and email (the code's email fallback,
 * and "Back to the text code"). A plain form post, so it works before
 * hydration too; the server drops the code pending for the method being left
 * and opens email only through `walletEmailFallbackGate`.
 *
 * A switch to email is always a quiet link, whatever `variant` asks for, so
 * email can never be presented as a first choice beside the phone.
 */
export function CustomerLoginMethodSwitch({
  to,
  submitAction,
  pending,
  children,
  variant = "outline",
}: {
  to: JoinContactMethod
  submitAction: (data: FormData) => void
  pending: boolean
  children: ReactNode
  variant?: "outline" | "link"
}) {
  const quiet = to === "email" || variant === "link"
  return (
    <form action={submitAction} className="grid">
      <input type="hidden" name="intent" value="switch-method" />
      <input type="hidden" name="method" value={to} />
      <SubmitButton
        variant={quiet ? "link" : "outline"}
        size={quiet ? "xs" : "lg"}
        className={
          quiet
            ? "h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
            : "w-full"
        }
        disabled={pending}
        pendingLabel="Opening…"
      >
        {children}
      </SubmitButton>
    </form>
  )
}
