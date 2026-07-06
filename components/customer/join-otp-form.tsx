"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  requestCustomerIdentityAction,
  verifyCustomerOtpAction,
  type CustomerIdentityState,
} from "@/app/m/[merchantSlug]/join/actions"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { otpFieldMaxLength } from "@/lib/customer/experience/otp-field"
import type { LocationRequirement } from "@/lib/customer/experience/types"

const identityInitialState: CustomerIdentityState = {}

export type CustomerOtpFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  contact: string
  location: LocationRequirement
}

export function CustomerOtpForm({
  merchantSlug,
  qrId,
  referralCode,
  contact,
  location,
}: CustomerOtpFormProps) {
  const [verifyState, verifyAction] = useActionState(
    verifyCustomerOtpAction,
    identityInitialState
  )
  const [requestState, requestAction, requestPending] = useActionState(
    requestCustomerIdentityAction,
    identityInitialState
  )
  const state = verifyState
  // A failed or rate-limited resend returns errors; a successful one returns
  // a confirmation message. Both surface inside the aria-live card below so
  // the customer at the counter hears and sees the outcome (CUS-P1-02). While
  // a fresh resend is in flight the previous outcome clears, so settling
  // re-announces through the live region.
  const resendError = requestPending
    ? undefined
    : (requestState.errors?.form ?? requestState.errors?.contact)
  const resendMessage =
    requestPending || resendError ? undefined : requestState.message
  const phoneStepHref = `/m/${merchantSlug}/join?${
    qrId ? `qr=${encodeURIComponent(qrId)}&` : ""
  }${referralCode ? `ref=${encodeURIComponent(referralCode)}&` : ""}step=phone`

  void location

  return (
    <div className="grid gap-4">
      <form action={verifyAction} className="grid gap-4">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <input type="hidden" name="ref" value={referralCode ?? ""} />
        <div className="grid gap-2">
          <label htmlFor="otp" className="eyebrow">
            Text code
          </label>
          <input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={otpFieldMaxLength()}
            className={`${customerInputClass} font-mono`}
            aria-invalid={Boolean(state.errors?.otp)}
            aria-describedby={state.errors?.otp ? "otp-error" : "otp-hint"}
          />
          {state.errors?.otp ? (
            <p
              id="otp-error"
              role="alert"
              aria-live="assertive"
              className="text-sm text-destructive"
            >
              {state.errors.otp}
            </p>
          ) : (
            <p
              id="otp-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              Enter the verification code sent to your phone.
            </p>
          )}
        </div>
        {/* Wet Ink error treatment (CUS-P2-07): the shared banner instead of
            hand-rolled 1px boxes. */}
        {state.errors?.form ? (
          <StatusBanner tone="error" title={state.errors.form} />
        ) : null}
        {state.errors?.contact ? (
          <StatusBanner tone="error" title={state.errors.contact} />
        ) : null}
        <SubmitButton size="lg" className="w-full" pendingLabel="Checking…">
          Save my card
        </SubmitButton>
      </form>

      <form action={requestAction} className="grid gap-3">
        <input type="hidden" name="merchantSlug" value={merchantSlug} />
        <input type="hidden" name="qrId" value={qrId ?? ""} />
        <input type="hidden" name="ref" value={referralCode ?? ""} />
        <input type="hidden" name="contact" value={contact} />
        {/* Marks this submission as a resend so the action answers in place
            (returned state) instead of redirecting the phone step forward. */}
        <input type="hidden" name="resend" value="1" />
        <div
          className="surface-card grid gap-2 p-3 text-left"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow text-muted-foreground">Sent to</span>
            <SubmitButton
              variant="link"
              size="xs"
              className="shrink-0 text-xs"
              pendingLabel="Sending…"
            >
              Resend code
            </SubmitButton>
          </div>
          <p className="text-sm font-bold tabular-nums">{contact}</p>
          {resendError ? (
            <p className="text-sm leading-6 text-destructive">{resendError}</p>
          ) : null}
          {resendMessage ? (
            <p className="text-sm leading-6 font-semibold text-foreground">
              {resendMessage}
            </p>
          ) : null}
          <Link
            href={phoneStepHref}
            className="w-fit text-xs font-bold underline underline-offset-4"
          >
            Use a different number
          </Link>
        </div>
      </form>
    </div>
  )
}
