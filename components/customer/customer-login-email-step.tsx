"use client"

import { useEffect, useState } from "react"

import {
  CustomerLoginMethodSwitch,
  type CustomerLoginStepProps,
} from "@/components/customer/customer-login-method-switch"
import { CustomerLoginScanStep } from "@/components/customer/customer-login-scan-step"
import { CustomerOtpInput } from "@/components/customer/customer-otp-input"
import { customerInputClass } from "@/components/customer/input-class"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Field, FieldGroup } from "@/components/ui/field"
import { useOtpRetryCountdown } from "@/hooks/use-otp-retry-countdown"
import { JOIN_EMAIL_SPAM_HINT } from "@/lib/customer/experience/copy"
import { LOGIN_COPY } from "@/lib/customer/login-copy"
import { resendClock, resendWaiting } from "@/lib/customer/otp-resend"

/** After this long without a code, suggest the spam folder. */
const SPAM_HINT_AFTER_MS = 30_000

/**
 * /home/login by email: the address, then the code from the email. The code
 * goes out by email, so it arrives over the venue's Wi-Fi when there is no
 * mobile signal. Whether a card uses the address is said only after the
 * code proves the inbox is the customer's.
 */
export function CustomerLoginEmailStep(props: CustomerLoginStepProps) {
  const { state } = props
  const editing = Boolean(state.fields?.editingContact)
  const noCards = Boolean(state.fields?.noCards) && !editing
  const otpSent = Boolean(state.fields?.otpSent) && !editing
  if (noCards) return <EmailScanStep {...props} />
  return otpSent ? (
    <EmailCodeStep {...props} />
  ) : (
    <EmailRequestStep {...props} />
  )
}

/**
 * The code proved the inbox and no card uses the address. As on the phone
 * step, point at the venue QR instead of offering another code, with one way
 * back to the mobile number.
 */
function EmailScanStep({
  state,
  submitAction,
  pending,
}: CustomerLoginStepProps) {
  return (
    <CustomerLoginScanStep message={pending ? undefined : state.message}>
      <form action={submitAction}>
        <input type="hidden" name="intent" value="email-edit" />
        <input type="hidden" name="email" value={state.fields?.email ?? ""} />
        <SubmitButton
          variant="link"
          size="xs"
          className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
          disabled={pending}
          pendingLabel="Changing email…"
        >
          {LOGIN_COPY.changeEmail}
        </SubmitButton>
      </form>
      <CustomerLoginMethodSwitch
        to="phone"
        submitAction={submitAction}
        pending={pending}
        variant="link"
      >
        {LOGIN_COPY.useMobile}
      </CustomerLoginMethodSwitch>
    </CustomerLoginScanStep>
  )
}

function EmailRequestStep({
  state,
  submitAction,
  pending,
  alternate,
}: CustomerLoginStepProps) {
  const editing = Boolean(state.fields?.editingContact)
  const emailError = editing ? undefined : state.errors?.email
  const formError = editing ? undefined : state.errors?.form
  const message = editing || pending ? undefined : state.message
  // The field takes focus when this step replaces the phone step (a method
  // switch answers with no address yet) or reopens for a different address,
  // so a keyboard or screen-reader customer lands on it, as on the join page.
  // It only mounts once per switch, so an error re-render never moves focus.
  const focusField = editing || !state.fields?.email

  return (
    <div className="grid gap-3">
      <form action={submitAction}>
        <input type="hidden" name="intent" value="email-request" />
        <FieldGroup className="gap-4">
          <Field className="gap-2" data-invalid={Boolean(emailError)}>
            <label htmlFor="email" className="eyebrow">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus={focusField}
              placeholder="you@example.com"
              defaultValue={state.fields?.email ?? ""}
              className={customerInputClass}
              aria-invalid={Boolean(emailError)}
              // The Wi-Fi line is the heading's support (loginHeading), as on
              // the join email step, so it is not repeated under the field.
              aria-describedby={emailError ? "email-error" : undefined}
            />
            {emailError ? (
              <p
                id="email-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {emailError}
              </p>
            ) : null}
          </Field>
          {formError ? <StatusBanner tone="error" title={formError} /> : null}
          {message ? (
            <p role="status" className="text-sm leading-6">
              {message}
            </p>
          ) : null}
          <SubmitButton
            size="lg"
            className="w-full"
            disabled={pending}
            pendingLabel="Sending…"
          >
            {LOGIN_COPY.emailSend}
          </SubmitButton>
        </FieldGroup>
      </form>
      {alternate}
    </div>
  )
}

function EmailCodeStep({
  state,
  submitAction,
  pending,
  next,
}: CustomerLoginStepProps) {
  const fields = state.fields
  const verifyError = state.errors?.otp
  const formError = state.errors?.form
  const message = pending ? undefined : state.message
  const countdown = useOtpRetryCountdown(
    fields?.retryAt ? new Date(fields.retryAt * 1_000).toISOString() : undefined
  )
  const showSpamHint = useElapsed(SPAM_HINT_AFTER_MS)

  return (
    <div className="grid gap-4">
      <form action={submitAction}>
        <input type="hidden" name="intent" value="email-verify" />
        <input type="hidden" name="next" value={next} />
        <FieldGroup className="gap-4">
          <Field className="gap-2" data-invalid={Boolean(verifyError)}>
            <label htmlFor="otp" className="eyebrow">
              {LOGIN_COPY.emailCodeLabel}
            </label>
            <CustomerOtpInput
              id="otp"
              name="otp"
              autoFocus
              className={`${customerInputClass} font-mono`}
              aria-invalid={Boolean(verifyError)}
              aria-describedby={verifyError ? "otp-error" : "otp-hint"}
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
          </Field>
          {formError ? <StatusBanner tone="error" title={formError} /> : null}
          <SubmitButton
            size="lg"
            className="w-full"
            disabled={pending}
            pendingLabel="Checking…"
          >
            {LOGIN_COPY.continue}
          </SubmitButton>
        </FieldGroup>
      </form>

      <div className="grid gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-2.5">
        {/* A resend goes to the pending address only; the server ignores
            anything else the form could post. */}
        <form
          action={submitAction}
          className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"
        >
          <input type="hidden" name="intent" value="email-request" />
          <input type="hidden" name="resend" value="1" />
          <SubmitButton
            variant="link"
            size="xs"
            className="tabular-nums"
            // Disabled only once the client clock runs, so a resend still
            // posts before hydration; the server keeps the cooldown anyway.
            disabled={pending || resendWaiting(countdown)}
            pendingLabel="Sending…"
          >
            {resendWaiting(countdown)
              ? `${LOGIN_COPY.emailResend} in ${resendClock(countdown.remainingSeconds)}`
              : LOGIN_COPY.emailResend}
          </SubmitButton>
        </form>
        <form action={submitAction}>
          <input type="hidden" name="intent" value="email-edit" />
          <input type="hidden" name="email" value={fields?.email ?? ""} />
          <SubmitButton
            variant="link"
            size="xs"
            className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal"
            disabled={pending}
            pendingLabel="Changing email…"
          >
            {LOGIN_COPY.changeEmail}
          </SubmitButton>
        </form>
        <CustomerLoginMethodSwitch
          to="phone"
          submitAction={submitAction}
          pending={pending}
          variant="link"
        >
          {LOGIN_COPY.backToPhone}
        </CustomerLoginMethodSwitch>
        <p
          role="status"
          aria-live="polite"
          className="text-xs leading-5 text-muted-foreground"
        >
          {message}
        </p>
      </div>
    </div>
  )
}

/** True once `ms` has passed since the step appeared. */
function useElapsed(ms: number): boolean {
  const [elapsed, setElapsed] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setElapsed(true), ms)
    return () => window.clearTimeout(timer)
  }, [ms])
  return elapsed
}
