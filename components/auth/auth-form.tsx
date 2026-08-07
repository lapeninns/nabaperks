"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState, useEffect, useRef, useState } from "react"

import { signupOtpAction, type AuthActionState } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { OtpResendControl } from "@/components/auth/otp-resend-control"
import { Eyebrow, VenueMark } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  merchantOtpFocusTarget,
  merchantOtpInitialState,
} from "@/lib/auth/merchant-auth-action-state"
import {
  merchantPasswordResetHref,
  merchantSignupHref,
} from "@/lib/navigation/merchant-auth-hrefs"
import { cn } from "@/lib/utils"

type AuthAction = (
  state: AuthActionState,
  formData: FormData
) => Promise<AuthActionState>

type AuthFormProps = {
  readonly action: AuthAction
  readonly mode: "sign-in"
  readonly next?: string
  readonly initialEmail?: string
  readonly embedded?: boolean
}

export function AuthForm({
  action,
  next: requestedNext,
  initialEmail,
  embedded = false,
}: AuthFormProps) {
  const next = requestedNext ?? "/app"

  return (
    <SignInForm
      action={action}
      next={next}
      initialEmail={initialEmail}
      embedded={embedded}
    />
  )
}

function SignInForm({
  action,
  next,
  initialEmail,
  embedded,
}: {
  readonly action: AuthAction
  readonly next: string
  readonly initialEmail?: string
  readonly embedded: boolean
}) {
  const [email, setEmail] = useState(initialEmail ?? "")
  const [state, formAction, signInPending] = useActionState(action, {
    fields: { email: initialEmail, next },
  })
  const [freshCodeState, freshCodeAction, freshCodePending] = useActionState(
    signupOtpAction,
    merchantOtpInitialState({
      flow: "signup",
      step: "verify",
      email: initialEmail ?? "",
      next,
    })
  )
  const freshCodeRecoveryRef = useRef<HTMLFormElement>(null)
  const normalizedEmail = email.trim().toLowerCase()
  const recoveryEmail = state.fields?.email ?? normalizedEmail
  const canSendFreshCode =
    state.outcome === "verification_required" &&
    Boolean(recoveryEmail) &&
    recoveryEmail === normalizedEmail
  const anyPending = signInPending || freshCodePending

  useEffect(() => {
    const shouldFocusRecovery =
      state.outcome === "verification_required" ||
      merchantOtpFocusTarget(freshCodeState.outcome) === "recovery"
    if (!shouldFocusRecovery) return

    const frame = window.requestAnimationFrame(() => {
      freshCodeRecoveryRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [freshCodeState, state.outcome])

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        {embedded ? null : <FormHeader />}
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={state.errors?.email}
        />
        <AuthField
          id="password"
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={state.errors?.password}
        />
        <input type="hidden" name="next" value={next} />
        <div className="flex justify-end">
          <Link
            href={merchantPasswordResetHref({
              email: normalizedEmail || undefined,
              next,
            })}
            className="focus-ring inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {state.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{state.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton
          pendingLabel="Opening…"
          className="w-full"
          disabled={anyPending}
        >
          Log in
        </SubmitButton>
      </form>
      {canSendFreshCode ? (
        <form
          ref={freshCodeRecoveryRef}
          action={freshCodeAction}
          aria-label="Get a fresh verification code"
          tabIndex={-1}
          className="focus-target grid gap-3 rounded-lg"
        >
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="source" value="login" />
          <input type="hidden" name="email" value={recoveryEmail} />
          <input type="hidden" name="next" value={next} />
          {freshCodeState.errors?.form ? (
            <Alert variant="destructive">
              <AlertDescription>{freshCodeState.errors.form}</AlertDescription>
            </Alert>
          ) : null}
          {freshCodeState.message ? (
            <Alert role="status" aria-live="polite">
              <AlertDescription>{freshCodeState.message}</AlertDescription>
            </Alert>
          ) : null}
          <OtpResendControl
            retryAt={freshCodeState.retryAt}
            disabled={anyPending}
            variant="outline"
            buttonLabel="Get a fresh code"
            pendingLabel="Sending fresh code…"
          />
        </form>
      ) : null}
      <SwitchPrompt email={normalizedEmail || undefined} next={next} />
    </div>
  )
}

function FormHeader() {
  return (
    <div className="grid justify-items-center gap-2 pb-1">
      <VenueMark name="Nabaperks" caption="Counter" />
      <Eyebrow>Back to the counter</Eyebrow>
    </div>
  )
}

function SwitchPrompt({
  email,
  next,
}: {
  readonly email?: string
  readonly next: string
}) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      New venue?{" "}
      <SwitchPromptLink href={merchantSignupHref({ email, next })}>
        Start your launch
      </SwitchPromptLink>
    </p>
  )
}

function SwitchPromptLink({
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
