"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  requestCustomerIdentityAction,
  verifyCustomerOtpAction,
  type CustomerIdentityState,
} from "@/app/m/[merchantSlug]/join/actions"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  OTP_TEXT_FALLBACK_LABEL,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

const identityInitialState: CustomerIdentityState = {}

export type CustomerOtpFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  contactLast4: string
  /** Channel that carried the code — the row says so and offers the other. */
  channel?: OtpChannel
}

export function CustomerOtpForm({
  merchantSlug,
  qrId,
  referralCode,
  contactLast4,
  channel = "sms",
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
  const phoneStepHref = buildCustomerJoinHref(merchantSlug, {
    qrId,
    referralCode,
    step: "phone",
  })
  const freshCodeError =
    state.errors?.contact ?? requestState.errors?.contact ?? undefined
  const needsFreshCode = Boolean(freshCodeError)
  // A text is offered only when the code went out on WhatsApp; if it already
  // went by text, that is because WhatsApp refused the number.
  const offersText = channel === "whatsapp"

  return (
    <div className="grid gap-4">
      {needsFreshCode ? (
        <>
          <StatusBanner tone="error" title={freshCodeError} />
          <Button asChild size="lg" className="w-full">
            <Link href={phoneStepHref}>Request a new code</Link>
          </Button>
        </>
      ) : (
        <>
          <form action={verifyAction} className="grid gap-4">
            <input type="hidden" name="merchantSlug" value={merchantSlug} />
            <input type="hidden" name="qrId" value={qrId ?? ""} />
            <input type="hidden" name="ref" value={referralCode ?? ""} />
            <div className="grid gap-2">
              <label htmlFor="otp" className="eyebrow">
                Your code
              </label>
              <CustomerOtpInput
                id="otp"
                name="otp"
                autoFocus
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
                  Paste or type the code from the message.
                </p>
              )}
            </div>
            {/* Wet Ink error treatment (CUS-P2-07): the shared banner instead
                of hand-rolled 1px boxes. */}
            {state.errors?.form ? (
              <StatusBanner tone="error" title={state.errors.form} />
            ) : null}
            <SubmitButton size="lg" className="w-full" pendingLabel="Checking…">
              Check code
            </SubmitButton>
          </form>

          <form action={requestAction} className="grid gap-3">
            <input type="hidden" name="merchantSlug" value={merchantSlug} />
            <input type="hidden" name="qrId" value={qrId ?? ""} />
            <input type="hidden" name="ref" value={referralCode ?? ""} />
            {/* Marks this submission as a resend so the action answers in place
                (returned state) instead of redirecting the phone step forward. */}
            <input type="hidden" name="resend" value="1" />
            <input type="hidden" name="channel" value={channel} />
            {/* One compact row instead of a second card: where the code went,
                the resend, and the way out, all inside one live region so a
                resend outcome is announced in place (CUS-P1-02). */}
            <div
              className="grid gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-2.5 text-left"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Sent to </span>
                  <span className="font-bold tabular-nums">
                    Phone ending {contactLast4}
                  </span>
                </p>
                <SubmitButton
                  variant="link"
                  size="xs"
                  className="-mr-2 shrink-0 text-xs"
                  pendingLabel="Sending…"
                >
                  Resend code
                </SubmitButton>
              </div>
              {resendError ? (
                <p className="text-sm leading-5 text-destructive">
                  {resendError}
                </p>
              ) : null}
              {resendMessage ? (
                <p className="text-sm leading-5 font-semibold text-foreground">
                  {resendMessage}
                </p>
              ) : null}
              <Link
                href={phoneStepHref}
                className="w-fit text-xs font-bold underline underline-offset-4"
              >
                Wrong number? Use a different one
              </Link>
            </div>
          </form>

          {/* A text, one tap away: a resend by SMS through the same admission
              and the same neutral reply. */}
          {offersText ? (
            <form action={requestAction} className="grid justify-items-center">
              <input type="hidden" name="merchantSlug" value={merchantSlug} />
              <input type="hidden" name="qrId" value={qrId ?? ""} />
              <input type="hidden" name="ref" value={referralCode ?? ""} />
              <input type="hidden" name="resend" value="1" />
              <input type="hidden" name="channel" value="sms" />
              <SubmitButton
                variant="link"
                size="xs"
                className="text-xs"
                pendingLabel="Sending…"
              >
                {OTP_TEXT_FALLBACK_LABEL}
              </SubmitButton>
            </form>
          ) : null}
        </>
      )}
    </div>
  )
}
