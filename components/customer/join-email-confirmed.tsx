"use client"

import { useActionState } from "react"

import {
  startEmailWalletAction,
  switchJoinToPhoneAction,
  type CustomerEmailChoiceState,
} from "@/app/m/[merchantSlug]/join/email-actions"
import { SubmitButton } from "@/components/forms"
import { JoinHiddenFields } from "@/components/customer/join-email-forms"
import { StatusBanner } from "@/components/loyalty"
import { JOIN_USE_MOBILE_NUMBER_LABEL } from "@/lib/customer/experience/copy"

const confirmedInitialState: CustomerEmailChoiceState = {}

export type CustomerEmailConfirmedProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  /**
   * Mode `full`, a handoff left by the previous build: one "Continue" spends
   * it. Otherwise (mode `existing`) no card uses the email: one way back to
   * the phone.
   */
  canCreate: boolean
}

/**
 * After a verified fallback email that no card holds. Never a choice screen:
 * each case has exactly one action.
 *
 * - No card uses this email (mode `existing`): "Use my mobile number", which
 *   drops the handoff and opens the number form.
 * - A confirmed-email handoff from the previous build (mode `full`):
 *   "Continue", which spends it once on the server and goes to the terms
 *   step. If that fails (expired, spent, conflict), the error says so and the
 *   mobile number is offered as the way on.
 */
export function CustomerEmailConfirmed({
  merchantSlug,
  qrId,
  referralCode,
  canCreate,
}: CustomerEmailConfirmedProps) {
  const [state, continueAction] = useActionState(
    startEmailWalletAction,
    confirmedInitialState
  )
  const fields = (
    <JoinHiddenFields
      merchantSlug={merchantSlug}
      qrId={qrId}
      referralCode={referralCode}
    />
  )
  const phoneForm = (primary: boolean) => (
    <form action={switchJoinToPhoneAction} className="grid">
      {fields}
      <SubmitButton
        variant={primary ? "default" : "link"}
        size={primary ? "lg" : "xs"}
        className={
          primary
            ? "h-auto min-h-12 w-full py-3 whitespace-normal"
            : "min-h-11 w-fit justify-self-center text-xs"
        }
        pendingLabel="Opening…"
      >
        {JOIN_USE_MOBILE_NUMBER_LABEL}
      </SubmitButton>
    </form>
  )

  if (!canCreate) return <div className="grid gap-4">{phoneForm(true)}</div>

  return (
    <div className="grid gap-4">
      {state.errors?.form ? (
        <StatusBanner tone="error" title={state.errors.form} />
      ) : null}
      <form action={continueAction} className="grid">
        {fields}
        <SubmitButton
          size="lg"
          className="h-auto min-h-12 w-full py-3 whitespace-normal"
          pendingLabel="Continuing…"
        >
          Continue
        </SubmitButton>
      </form>
      {state.errors?.form ? phoneForm(false) : null}
    </div>
  )
}
