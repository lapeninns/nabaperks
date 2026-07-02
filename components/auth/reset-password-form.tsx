"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"

import {
  confirmPasswordResetAction,
  requestPasswordResetAction,
  type AuthActionState,
} from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"

const initialState: AuthActionState = {}

type ResetPasswordFormProps = {
  readonly otpLength: number
}

export function ResetPasswordForm({ otpLength }: ResetPasswordFormProps) {
  const [requestState, requestAction] = useActionState(
    requestPasswordResetAction,
    initialState
  )
  const [confirmState, confirmAction] = useActionState(
    confirmPasswordResetAction,
    initialState
  )
  const codeState = confirmState.fields?.otpSent ? confirmState : requestState
  const otpSent = Boolean(
    requestState.fields?.otpSent || confirmState.fields?.otpSent
  )

  // When the confirm step appears, move focus to the reset-code field so
  // keyboard and screen-reader merchants land on the new input (the
  // profile-form first-invalid-focus pattern).
  useEffect(() => {
    if (!otpSent) return
    document.getElementById("otp")?.focus()
  }, [otpSent])

  return (
    <div className="grid gap-4">
      <form action={requestAction} className="grid gap-4">
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={codeState.fields?.email}
          error={requestState.errors?.email}
        />
        {requestState.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{requestState.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {requestState.message ? (
          <Alert className="bg-accent">
            <AlertDescription className="text-accent-foreground">
              {requestState.message}
            </AlertDescription>
          </Alert>
        ) : null}
        {/* Once the code is out, resend is a quiet secondary action — the one
            primary CTA on screen is "Set new password" below. */}
        <SubmitButton
          pendingLabel="Sending…"
          variant={otpSent ? "ghost" : "default"}
          className="w-full"
        >
          {otpSent ? "Resend reset code" : "Send reset code"}
        </SubmitButton>
      </form>

      {otpSent ? (
        <form action={confirmAction} className="grid gap-4">
          <input
            type="hidden"
            name="email"
            value={codeState.fields?.email ?? ""}
          />
          <AuthField
            id="otp"
            label="Reset code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={otpLength}
            className="font-mono tracking-[0.18em]"
            error={confirmState.errors?.otp}
          />
          <AuthField
            id="password"
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            description="At least 8 characters, with letters and numbers."
            error={confirmState.errors?.password}
          />
          <AuthField
            id="confirmPassword"
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={confirmState.errors?.confirmPassword}
          />
          {confirmState.errors?.form ? (
            <Alert variant="destructive">
              <AlertDescription>{confirmState.errors.form}</AlertDescription>
            </Alert>
          ) : null}
          <SubmitButton pendingLabel="Saving…" className="w-full">
            Set new password
          </SubmitButton>
        </form>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        >
          Back to log in
        </Link>
      </p>
    </div>
  )
}
