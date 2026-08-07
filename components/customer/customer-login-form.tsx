"use client"

import { useActionState } from "react"

import {
  requestCustomerLoginOtpAction,
  verifyCustomerLoginOtpAction,
  type CustomerLoginOtpState,
} from "@/app/home/actions"
import {
  customerInputClass,
  customerOtpInputClass,
} from "@/components/customer/input-class"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { JOIN_PHONE_CODE_HINT } from "@/lib/customer/experience/copy"
import { otpFieldMaxLength } from "@/lib/customer/experience/otp-field"

const initialState: CustomerLoginOtpState = {}

type CustomerLoginFormProps = {
  readonly next: string
}

function hasLoginActionResult(state: CustomerLoginOtpState) {
  return Boolean(state.fields || state.errors || state.message)
}

export function CustomerLoginForm({ next }: CustomerLoginFormProps) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestCustomerLoginOtpAction,
    initialState
  )
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCustomerLoginOtpAction,
    initialState
  )

  const state = hasLoginActionResult(verifyState) ? verifyState : requestState
  const contact = state.fields?.contact ?? requestState.fields?.contact ?? ""
  const otpSent = Boolean(state.fields?.otpSent)
  const formError = state.errors?.form
  const verifyError =
    state.errors?.otp ?? verifyState.errors?.form ?? verifyState.errors?.contact

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        {/* Once the code is out, the phone field collapses to a read-only
            summary — the pattern join-otp-form already uses. Before this, the
            page showed a full phone field and a vermillion "Resend code"
            button ABOVE the OTP field and its "Open my cards" button: two
            primary buttons on one screen with the destructive-to-progress one
            first in reading order, and with the keyboard up "Resend code" was
            often the only one visible (CUS 02#54). */}
        <div
          className={
            otpSent && !state.errors?.contact ? "hidden" : "grid gap-2"
          }
        >
          <label htmlFor="contact" className="eyebrow">
            Phone number
          </label>
          <input
            id="contact"
            name="contact"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="07400 123456"
            defaultValue={state.fields?.contact}
            className={customerInputClass}
            aria-invalid={Boolean(state.errors?.contact)}
            aria-describedby={
              state.errors?.contact ? "contact-error" : "contact-hint"
            }
          />
          {state.errors?.contact ? (
            // role="alert" so the inline error announces on arrival, matching
            // the OTP error below — described-by alone stays silent until the
            // field is re-focused.
            <p
              id="contact-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {state.errors.contact}
            </p>
          ) : (
            // Same expectation-setting hint as the join phone step
            // (CUS-P3-14).
            <p
              id="contact-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              {JOIN_PHONE_CODE_HINT}
            </p>
          )}
        </div>
        {formError && formError !== verifyError ? (
          // Wet Ink error treatment (CUS-P2-07): the shared banner (2px ink,
          // role="alert" via Alert) instead of a hand-rolled 1px box.
          <StatusBanner tone="error" title={formError} />
        ) : null}
        {state.message ? (
          // The Wet Ink success face (2px ink, reward wash) rather than a 1px
          // border-reward/30 box — a 1px border in a 2px system, in a colour
          // that appears nowhere else, reading as ghosted rather than
          // confirmed (CUS 02#40). This is not StatusBanner because that face
          // carries role="alert"; "we sent your code" is a polite status, not
          // an interruption, so the live region stays as it was.
          <div
            role="status"
            aria-live="polite"
            className="grid gap-1 rounded-lg border-2 border-ink bg-reward/12 px-3 py-2 text-sm text-foreground"
          >
            <p>{state.message}</p>
            <p className="text-xs leading-5">
              If it does not arrive, check the number and resend the code.
            </p>
          </div>
        ) : null}
        {/* The field stays mounted (hidden) rather than unmounted, so the
            resend submits the same number without the member retyping it. */}
        {otpSent && !state.errors?.contact ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm leading-6">
              <span className="eyebrow">Code sent to</span>{" "}
              <span className="font-bold">{contact}</span>
            </p>
            <Button
              type="submit"
              size="sm"
              variant="link"
              className="px-0"
              disabled={requestPending}
            >
              {requestPending ? "Sending…" : "Resend code"}
            </Button>
          </div>
        ) : (
          <Button type="submit" disabled={requestPending}>
            {requestPending ? "Sending…" : "Send code"}
          </Button>
        )}
      </form>

      {otpSent ? (
        <form action={verifyAction} className="grid gap-4">
          <input type="hidden" name="contact" value={contact} />
          <input type="hidden" name="next" value={next} />
          <div className="grid gap-2">
            <label htmlFor="otp" className="eyebrow">
              Phone code
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={otpFieldMaxLength()}
              className={customerOtpInputClass}
              aria-invalid={Boolean(verifyError)}
              aria-describedby={verifyError ? "otp-error" : undefined}
            />
            {verifyError ? (
              <p
                id="otp-error"
                role="alert"
                aria-live="assertive"
                className="text-sm text-destructive"
              >
                {verifyError}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={verifyPending}>
            {verifyPending ? "Checking…" : OPEN_MY_CARDS_LABEL}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
