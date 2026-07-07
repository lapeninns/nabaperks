"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState, useEffect } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import {
  resendSignupOtpAction,
  verifyEmailOtpAction,
} from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { Eyebrow } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

type SignupVerifyFormProps = {
  readonly email: string
  readonly name?: string
  readonly next?: string
  readonly otpLength: number
}

const initialState: AuthActionState = {}

export function SignupVerifyForm({
  email,
  name,
  next = "/app/onboarding",
  otpLength,
}: SignupVerifyFormProps) {
  const [verifyState, verifyFormAction] = useActionState(
    verifyEmailOtpAction,
    initialState
  )
  const [resendState, resendFormAction] = useActionState(
    resendSignupOtpAction,
    initialState
  )
  const currentEmail =
    verifyState.fields?.email ?? resendState.fields?.email ?? email
  const currentName =
    verifyState.fields?.name ?? resendState.fields?.name ?? name ?? ""

  useEffect(() => {
    document.getElementById("otp")?.focus()
  }, [])

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border-2 border-dashed border-border bg-secondary/55 px-3 py-2">
        <Eyebrow>Code sent to</Eyebrow>
        <p className="break-words text-sm leading-6 font-extrabold">
          {currentEmail}
        </p>
      </div>

      <form action={verifyFormAction} className="grid gap-4">
        <input type="hidden" name="name" value={currentName} />
        <input type="hidden" name="email" value={currentEmail} />
        <input type="hidden" name="next" value={next} />
        <AuthField
          id="otp"
          label="Email code"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={otpLength}
          className="font-mono tracking-[0.18em]"
          error={verifyState.errors?.otp}
        />
        {verifyState.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{verifyState.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Checking…" className="w-full">
          Verify email
        </SubmitButton>
      </form>

      <form action={resendFormAction} className="grid gap-3">
        <input type="hidden" name="name" value={currentName} />
        <input type="hidden" name="email" value={currentEmail} />
        {resendState.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{resendState.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {resendState.message ? (
          <Alert className="bg-accent">
            <AlertDescription className="text-accent-foreground">
              {resendState.message}
            </AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Sending…" variant="ghost" className="w-full">
          Resend code
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Wrong email?{" "}
        <AuthPromptLink href="/signup">Back to sign up</AuthPromptLink>
      </p>
    </div>
  )
}

function AuthPromptLink({
  href,
  className,
  children,
}: {
  readonly href: string
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline",
        className
      )}
    >
      {children}
    </Link>
  )
}
