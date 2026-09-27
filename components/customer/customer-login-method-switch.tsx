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
  /** The other method, directly under the step's own button (D12). */
  readonly alternate?: ReactNode
  /**
   * Records this method as the code check submits. Owned by the login form,
   * which outlives both steps, so an answer in place (a wrong code, no
   * wallet) that swaps the step can still put the stored method back.
   */
  readonly onVerifySubmit: () => void
}

/**
 * "Use my email instead" / "Use my phone number instead". A plain form post,
 * so it works before hydration too; the server drops the code pending for the
 * method being left.
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
  return (
    <form action={submitAction} className="grid">
      <input type="hidden" name="intent" value="switch-method" />
      <input type="hidden" name="method" value={to} />
      <SubmitButton
        variant={variant}
        size={variant === "link" ? "xs" : "lg"}
        className={
          variant === "link"
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
