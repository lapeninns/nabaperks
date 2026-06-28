"use client"

import Link from "next/link"
import { useActionState } from "react"

import {
  confirmPasswordResetAction,
  requestPasswordResetAction,
  type AuthActionState,
} from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const initialState: AuthActionState = {}

export function ResetPasswordForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordResetAction,
    initialState
  )
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmPasswordResetAction,
    initialState
  )
  const codeState = confirmState.fields?.otpSent ? confirmState : requestState
  const otpSent = Boolean(
    requestState.fields?.otpSent || confirmState.fields?.otpSent
  )

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
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/10"
          >
            <AlertDescription>{requestState.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {requestState.message ? (
          <Alert className="border-reward/30 bg-accent">
            <AlertDescription className="text-accent-foreground">
              {requestState.message}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={requestPending} className="w-full">
          {requestPending
            ? "Sending..."
            : otpSent
              ? "Resend reset code"
              : "Send reset code"}
        </Button>
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
            maxLength={4}
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
            <Alert
              variant="destructive"
              className="border-destructive/30 bg-destructive/10"
            >
              <AlertDescription>{confirmState.errors.form}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={confirmPending} className="w-full">
            {confirmPending ? "Saving..." : "Set new password"}
          </Button>
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
