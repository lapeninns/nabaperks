"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"

import {
  requestCustomerEmailIdentityAction,
  verifyCustomerEmailOtpAction,
  type CustomerEmailIdentityState,
} from "@/app/m/[merchantSlug]/join/email-actions"
import { JoinHiddenFields } from "@/components/customer/join-email-forms"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { useOtpRetryCountdown } from "@/hooks/use-otp-retry-countdown"
import {
  JOIN_EMAIL_DELAYED,
  JOIN_EMAIL_SPAM_HINT,
} from "@/lib/customer/experience/copy"

const emailInitialState: CustomerEmailIdentityState = {}

/** After this long without a code, suggest the spam folder. */
const SPAM_HINT_AFTER_MS = 30_000

export type CustomerEmailOtpFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  /** Already masked on the server ("j***@example.com"). */
  maskedEmail: string
  /** Epoch seconds when a resend is allowed. */
  resendAvailableAt: number
  /** The latest send failed, so no code is described as on its way. */
  deliveryDelayed?: boolean
  /** "Use a different email": the email step, where a pending code is ignored. */
  emailStepHref: string
  phoneStepHref: string
}

/**
 * The code step for a join by email: where the code went, the code field, a
 * resend that counts down to the server's cooldown, and both ways out. A
 * resend always goes to the address already in the pending challenge.
 */
export function CustomerEmailOtpForm({
  merchantSlug,
  qrId,
  referralCode,
  maskedEmail,
  resendAvailableAt,
  deliveryDelayed = false,
  emailStepHref,
  phoneStepHref,
}: CustomerEmailOtpFormProps) {
  const [verifyState, verifyAction] = useActionState(
    verifyCustomerEmailOtpAction,
    emailInitialState
  )
  const [requestState, requestAction, requestPending] = useActionState(
    requestCustomerEmailIdentityAction,
    emailInitialState
  )
  const retryAtSeconds =
    requestState.fields?.resendAvailableAt ?? resendAvailableAt
  const countdown = useOtpRetryCountdown(
    new Date(retryAtSeconds * 1_000).toISOString()
  )
  const showSpamHint = useElapsed(SPAM_HINT_AFTER_MS)

  // A failed resend returns errors; a successful one returns "Use the latest
  // code we sent." Both are announced in the live row below. While a resend is
  // in flight the previous outcome clears, so settling re-announces.
  const resendError = requestPending
    ? undefined
    : (requestState.errors?.form ?? requestState.errors?.email)
  const resendMessage =
    requestPending || resendError ? undefined : requestState.message
  // Delayed until a resend from this screen is sent; a failed one says so
  // itself in `resendError`.
  const delayed = deliveryDelayed && !requestState.message
  const delayedNotice =
    delayed && !requestPending && !resendError ? JOIN_EMAIL_DELAYED : undefined

  return (
    <div className="grid gap-4">
      <form action={verifyAction} className="grid gap-4">
        <JoinHiddenFields
          merchantSlug={merchantSlug}
          qrId={qrId}
          referralCode={referralCode}
        />
        <div className="grid gap-2">
          <label htmlFor="otp" className="eyebrow">
            Your code
          </label>
          <CustomerOtpInput
            id="otp"
            name="otp"
            autoFocus
            className={`${customerInputClass} font-mono`}
            aria-invalid={Boolean(verifyState.errors?.otp)}
            aria-describedby={
              verifyState.errors?.otp ? "otp-error" : "otp-hint"
            }
          />
          {verifyState.errors?.otp ? (
            <p
              id="otp-error"
              role="alert"
              aria-live="assertive"
              className="text-sm text-destructive"
            >
              {verifyState.errors.otp}
            </p>
          ) : (
            <p
              id="otp-hint"
              className="text-xs leading-5 text-muted-foreground"
            >
              {showSpamHint
                ? JOIN_EMAIL_SPAM_HINT
                : "Paste or type the code from the email."}
            </p>
          )}
        </div>
        {verifyState.errors?.form ? (
          <StatusBanner tone="error" title={verifyState.errors.form} />
        ) : null}
        <SubmitButton size="lg" className="w-full" pendingLabel="Checking…">
          Check code
        </SubmitButton>
      </form>

      <form action={requestAction} className="grid gap-3">
        <JoinHiddenFields
          merchantSlug={merchantSlug}
          qrId={qrId}
          referralCode={referralCode}
        />
        {/* A resend answers in place and goes to the pending address only. */}
        <input type="hidden" name="resend" value="1" />
        <div
          className="grid gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-2.5 text-left"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 text-sm">
              <span className="text-muted-foreground">
                {delayed ? "Not sent yet to " : "Sent to "}
              </span>
              <span className="font-bold break-all">{maskedEmail}</span>
            </p>
            <SubmitButton
              variant="link"
              size="xs"
              className="-mr-2 shrink-0 text-xs tabular-nums"
              pendingLabel="Sending…"
              disabled={countdown.active}
            >
              {countdown.active && countdown.ready
                ? `Resend code in ${countdown.remainingSeconds}s`
                : "Resend code"}
            </SubmitButton>
          </div>
          {resendError ? (
            <p className="text-sm leading-5 text-destructive">{resendError}</p>
          ) : null}
          {delayedNotice ? (
            <p className="text-sm leading-5 text-destructive">
              {delayedNotice}
            </p>
          ) : null}
          {resendMessage ? (
            <p className="text-sm leading-5 font-semibold text-foreground">
              {resendMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-4">
            <Link
              href={emailStepHref}
              className="focus-ring inline-flex min-h-11 w-fit items-center text-xs font-bold underline underline-offset-4"
            >
              Use a different email
            </Link>
            <Link
              href={phoneStepHref}
              className="focus-ring inline-flex min-h-11 w-fit items-center text-xs font-bold underline underline-offset-4"
            >
              Use my phone instead
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}

/** True once `ms` has passed since the form appeared. */
function useElapsed(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setElapsed(true), ms)
    return () => window.clearTimeout(timer)
  }, [ms])
  return elapsed
}
