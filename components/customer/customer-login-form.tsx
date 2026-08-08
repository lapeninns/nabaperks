"use client"

import { useActionState } from "react"

import {
  requestCustomerLoginOtpAction,
  verifyCustomerLoginOtpAction,
  type CustomerLoginOtpState,
} from "@/app/home/actions"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { PhoneField } from "@/components/customer/phone-field"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { JOIN_PHONE_CODE_HINT } from "@/lib/customer/experience/copy"

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
        <PhoneField
          label="Phone number"
          className={
            otpSent && !state.errors?.contact ? "hidden" : "grid gap-2"
          }
          hint={JOIN_PHONE_CODE_HINT}
          error={state.errors?.contact}
          defaultValue={state.fields?.contact}
          autoFocus={false}
        />
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
            <CustomerOtpInput
              id="otp"
              autoFocus
              invalid={Boolean(verifyError)}
              describedBy={verifyError ? "otp-error" : undefined}
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
