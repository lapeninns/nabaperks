"use client"

import Link from "next/link"
import { useActionState, useEffect, useState } from "react"

import { passwordResetAction } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { OtpResendControl } from "@/components/auth/otp-resend-control"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { merchantOtpInitialState } from "@/lib/auth/merchant-auth-action-state"
import {
  merchantLoginHref,
  merchantSignupHref,
} from "@/lib/navigation/merchant-auth-hrefs"

type ResetPasswordFormProps = {
  readonly otpLength: number
  readonly initialEmail?: string
  readonly initialOtpSent?: boolean
  readonly initialRetryAt?: string
  readonly next?: string
}

/**
 * Compatibility name retained for imports and old /reset-password links. The
 * merchant boundary is passwordless: this form requests and verifies a
 * purpose-bound email access code and never accepts or updates a password.
 */
export function ResetPasswordForm({
  otpLength,
  initialEmail = "",
  initialOtpSent = false,
  initialRetryAt,
  next = "/app",
}: ResetPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState("")
  const [state, formAction, pending] = useActionState(
    passwordResetAction,
    merchantOtpInitialState({
      flow: "signin",
      step: initialOtpSent ? "verify" : "request",
      email: initialEmail.trim().toLowerCase(),
      next,
    })
  )
  const otpSent = state.context.step === "verify"
  const currentEmail = otpSent ? state.context.email : email

  useEffect(() => {
    if (state.outcome === "sent") {
      document.getElementById("otp")?.focus()
    }
  }, [state.outcome])

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <input
          type="hidden"
          name="intent"
          value={otpSent ? "confirm" : "request"}
        />
        <input type="hidden" name="next" value={state.context.next} />
        <AuthField
          id="email"
          label="Venue email"
          name="email"
          type="email"
          autoComplete="email"
          value={currentEmail}
          readOnly={otpSent}
          onChange={(event) => setEmail(event.target.value)}
          error={state.errors?.email}
        />
        {otpSent ? (
          <AuthField
            id="otp"
            label="Sign-in code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={otpLength}
            className="font-mono tracking-[0.18em]"
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, otpLength))
            }
            error={state.errors?.otp}
          />
        ) : null}
        {state.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{state.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {state.message ? (
          <Alert role="status" aria-live="polite">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Checking…" className="w-full">
          {otpSent ? "Open console" : "Email me a sign-in code"}
        </SubmitButton>
      </form>

      {otpSent ? (
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="email" value={currentEmail} />
          <input type="hidden" name="next" value={state.context.next} />
          <OtpResendControl
            retryAt={state.retryAt ?? initialRetryAt}
            disabled={pending}
            buttonLabel="Send another code"
            helpText="No email? Check spam or junk, then try again when the timer ends."
          />
          <Link
            href={merchantLoginHref({ next: state.context.next })}
            className="focus-ring justify-self-center rounded-full px-3 py-2 text-sm font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"
          >
            Use a different email
          </Link>
        </form>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        New venue?{" "}
        <Link
          href={merchantSignupHref({
            email: currentEmail,
            next: "/app/onboarding",
          })}
          className="focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"
        >
          Start your launch
        </Link>
      </p>
    </div>
  )
}
