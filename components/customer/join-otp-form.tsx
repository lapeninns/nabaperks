"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef } from "react"

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
import { useEmailFallbackReady } from "@/hooks/use-email-fallback-ready"
import { useOtpRetryCountdown } from "@/hooks/use-otp-retry-countdown"
import {
  PHONE_CODE_EMAIL_FALLBACK_LABEL,
  PHONE_CODE_EMAIL_FALLBACK_PENDING,
} from "@/lib/customer/experience/copy"
import {
  OTP_TEXT_FALLBACK_LABEL,
  type OtpChannel,
} from "@/lib/customer/otp-channel-core"
import {
  phoneCodeResendAt,
  resendWaiting,
  sendNewCodeLabel,
} from "@/lib/customer/otp-resend"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

const identityInitialState: CustomerIdentityState = {}

export type CustomerOtpFormProps = {
  merchantSlug: string
  qrId?: string
  referralCode?: string
  /** Channel that carried the code: the step says so and offers the other. */
  channel?: OtpChannel
  /**
   * Seconds, by the server's clock, before email may be offered instead,
   * counted from when this step appears. Absent while email sign-in is off:
   * no email option at all.
   */
  emailFallbackInSeconds?: number
  /**
   * When the server sent the code this step appeared with (epoch seconds).
   * A resend answers with its own, and the wait restarts from that one.
   */
  phoneCodeSentAt?: number
  /** The email step (`step=email`), keeping the QR and referral params. */
  emailStepHref?: string
}

export function CustomerOtpForm({
  merchantSlug,
  qrId,
  referralCode,
  channel = "sms",
  emailFallbackInSeconds,
  phoneCodeSentAt,
  emailStepHref,
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
  // a confirmation message. Both surface in one status line that stays
  // mounted, so the customer at the counter hears and sees the outcome
  // (CUS-P1-02). While a fresh resend is in flight the previous outcome
  // clears, so settling re-announces.
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
  // The expired-code answer replaces the focused form: focus moves to the one
  // way on, so it is not lost to the page.
  const freshCodeLinkRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (needsFreshCode) freshCodeLinkRef.current?.focus()
  }, [needsFreshCode])
  // A new code is offered after a short wait from the latest send, counted
  // on screen as on the email step. The server still admits each send.
  const resendCountdown = useOtpRetryCountdown(
    phoneCodeResendAt(requestState.fields?.phoneCodeSentAt ?? phoneCodeSentAt)
  )
  const resendStatus = resendError ?? resendMessage
  // A text is offered only when the code went out on WhatsApp; if it already
  // went by text, that is because WhatsApp refused the number.
  const offersText = channel === "whatsapp"
  // Email waits 30 seconds from the latest code: a resend answers with the
  // server's new wait, and one that could not be sent offers email at once.
  const fallback = emailFallbackAfterResend(requestState, {
    inSeconds: emailFallbackInSeconds,
    sentAt: phoneCodeSentAt,
  })

  return (
    <div className="grid gap-4">
      {needsFreshCode ? (
        <>
          <StatusBanner tone="error" title={freshCodeError} />
          <Button asChild size="lg" className="w-full">
            <Link ref={freshCodeLinkRef} href={phoneStepHref}>
              Send a new code
            </Link>
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
              Continue
            </SubmitButton>
          </form>

          {/* The ways out, quiet and in one order: a new code, the other
              channel, a different number, then (only once the server allows
              it) email. Only the status line below is live, so the ticking
              countdown and pending labels are never read out (CUS-P1-02). */}
          <div className="grid gap-1 text-left">
            <form action={requestAction} className="grid">
              <input type="hidden" name="merchantSlug" value={merchantSlug} />
              <input type="hidden" name="qrId" value={qrId ?? ""} />
              <input type="hidden" name="ref" value={referralCode ?? ""} />
              {/* Marks this submission as a resend so the action answers in
                  place (returned state) instead of redirecting forward. */}
              <input type="hidden" name="resend" value="1" />
              <input type="hidden" name="channel" value={channel} />
              <SubmitButton
                variant="link"
                size="xs"
                className="min-h-11 w-fit justify-self-start px-0 text-xs tabular-nums"
                pendingLabel="Sending…"
                disabled={resendWaiting(resendCountdown)}
              >
                {sendNewCodeLabel(resendCountdown)}
              </SubmitButton>
            </form>
            <p
              role="status"
              aria-live="polite"
              className={
                resendError
                  ? "text-sm leading-5 text-destructive"
                  : "text-sm leading-5 font-semibold text-foreground"
              }
            >
              {resendStatus ?? ""}
            </p>
            {/* A text, one tap away: a resend by SMS through the same
                admission and the same neutral reply. */}
            {offersText ? (
              <form action={requestAction} className="grid">
                <input type="hidden" name="merchantSlug" value={merchantSlug} />
                <input type="hidden" name="qrId" value={qrId ?? ""} />
                <input type="hidden" name="ref" value={referralCode ?? ""} />
                <input type="hidden" name="resend" value="1" />
                <input type="hidden" name="channel" value="sms" />
                <SubmitButton
                  variant="link"
                  size="xs"
                  className="min-h-11 w-fit justify-self-start px-0 text-xs"
                  pendingLabel="Sending…"
                  disabled={resendWaiting(resendCountdown)}
                >
                  {OTP_TEXT_FALLBACK_LABEL}
                </SubmitButton>
              </form>
            ) : null}
            <Link
              href={phoneStepHref}
              className="focus-ring inline-flex min-h-11 w-fit items-center text-xs font-bold underline underline-offset-4"
            >
              Wrong number? Change it
            </Link>
          </div>

          {/* No wrapper at all while email sign-in is off. */}
          {emailStepHref && emailFallbackInSeconds !== undefined ? (
            <EmailFallback
              // A new key restarts the wait for the latest code.
              key={fallback.key}
              inSeconds={fallback.inSeconds}
              emailStepHref={emailStepHref}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * The wait before email is offered, and what restarts it: the step's own code,
 * then each resend's answer. Only a resend that reached the server changes it.
 */
function emailFallbackAfterResend(
  requestState: CustomerIdentityState,
  initial: { inSeconds?: number; sentAt?: number }
): { key: string; inSeconds: number | undefined } {
  const fields = requestState.fields
  if (fields?.phoneSendFailed) {
    return { key: `failed-${fields.phoneCodeSentAt ?? ""}`, inSeconds: 0 }
  }
  if (fields?.phoneOtpSent && fields.phoneCodeSentAt !== undefined) {
    return {
      key: `sent-${fields.phoneCodeSentAt}`,
      inSeconds: fields.emailFallbackInSeconds,
    }
  }
  return { key: `sent-${initial.sentAt ?? ""}`, inSeconds: initial.inSeconds }
}

/**
 * Email, offered only once the server allows it: a quiet link under the
 * phone's own recovery options, never in place of them. Before that, one calm
 * line and no countdown. The polite live region announces the link.
 */
function EmailFallback({
  inSeconds,
  emailStepHref,
}: {
  inSeconds: number | undefined
  emailStepHref: string
}) {
  const ready = useEmailFallbackReady(inSeconds)
  return (
    <div aria-live="polite" className="grid text-left">
      {ready ? (
        <Link
          href={emailStepHref}
          className="focus-ring inline-flex min-h-11 w-fit items-center text-xs font-bold underline underline-offset-4"
        >
          {PHONE_CODE_EMAIL_FALLBACK_LABEL}
        </Link>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {PHONE_CODE_EMAIL_FALLBACK_PENDING}
        </p>
      )}
    </div>
  )
}
