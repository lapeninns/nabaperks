"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { Eyebrow, VenueMark } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"

type AuthAction = (
  state: AuthActionState,
  formData: FormData
) => Promise<AuthActionState>

type BaseAuthFormProps = {
  action: AuthAction
  next?: string
  embedded?: boolean
}

type SignInAuthFormProps = BaseAuthFormProps & {
  mode: "sign-in"
}

type SignUpAuthFormProps = BaseAuthFormProps & {
  mode: "sign-up"
  verifyAction?: AuthAction
  otpLength: number
}

type AuthFormProps = SignInAuthFormProps | SignUpAuthFormProps

const initialState: AuthActionState = {}

export function AuthForm(props: AuthFormProps) {
  const { action, mode, next: requestedNext, embedded = false } = props
  const isSignUp = mode === "sign-up"
  const next = requestedNext ?? (isSignUp ? "/app/onboarding" : "/app")

  return isSignUp ? (
    <SignUpForm
      action={action}
      verifyAction={props.verifyAction ?? action}
      next={next}
      embedded={embedded}
      otpLength={props.otpLength}
    />
  ) : (
    <SignInForm action={action} next={next} embedded={embedded} />
  )
}

function SignInForm({
  action,
  next,
  embedded,
}: {
  action: AuthAction
  next: string
  embedded: boolean
}) {
  const [state, formAction] = useActionState(action, initialState)

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        {embedded ? null : <FormHeader isSignUp={false} />}
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.fields?.email}
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
            href="/reset-password"
            className="inline-flex min-h-9 items-center rounded-full px-2 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
          >
            Forgot password?
          </Link>
        </div>
        {state.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{state.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Opening…" className="w-full">
          Log in
        </SubmitButton>
      </form>
      <SwitchPrompt isSignUp={false} />
    </div>
  )
}

function SignUpForm({
  action,
  verifyAction,
  next,
  embedded,
  otpLength,
}: {
  action: AuthAction
  verifyAction: AuthAction
  next: string
  embedded: boolean
  otpLength: number
}) {
  const [state, formAction] = useActionState(action, initialState)
  const [verifyState, verifyFormAction] = useActionState(
    verifyAction,
    initialState
  )
  const codeState = verifyState.fields?.otpSent ? verifyState : state
  const otpSent = Boolean(state.fields?.otpSent || verifyState.fields?.otpSent)

  // When the OTP step appears, move focus to the code field so keyboard and
  // screen-reader merchants land on the new input instead of rediscovering
  // the form (the profile-form first-invalid-focus pattern).
  useEffect(() => {
    if (!otpSent) return
    document.getElementById("otp")?.focus()
  }, [otpSent])

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        {embedded ? null : <FormHeader isSignUp />}
        <AuthField
          id="name"
          label="Your name"
          name="name"
          autoComplete="name"
          defaultValue={codeState.fields?.name}
          error={state.errors?.name}
        />
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={codeState.fields?.email}
          error={state.errors?.email}
        />
        {otpSent ? (
          <p className="rounded-xl border border-reward/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
            Password saved. Enter your email code below.
          </p>
        ) : (
          <>
            <AuthField
              id="password"
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              description="At least 8 characters, with letters and numbers."
              error={state.errors?.password}
            />
            <AuthField
              id="confirmPassword"
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              error={state.errors?.confirmPassword}
            />
          </>
        )}
        <input type="hidden" name="intent" value={otpSent ? "resend" : "create"} />
        <input type="hidden" name="next" value={next} />
        {state.errors?.form ? (
          <Alert variant="destructive">
            <AlertDescription>{state.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {state.message ? (
          <Alert className="bg-accent">
            <AlertDescription className="text-accent-foreground">
              {state.message}
            </AlertDescription>
          </Alert>
        ) : null}
        {/* Once the code is out, resend is a quiet secondary action — the one
            primary CTA on screen is "Verify email" below. */}
        <SubmitButton
          pendingLabel="Sending…"
          variant={otpSent ? "ghost" : "default"}
          className="w-full"
        >
          {otpSent ? "Resend code" : "Create account"}
        </SubmitButton>
      </form>

      {otpSent ? (
        <form action={verifyFormAction} className="grid gap-4">
          <input
            type="hidden"
            name="name"
            value={codeState.fields?.name ?? ""}
          />
          <input
            type="hidden"
            name="email"
            value={codeState.fields?.email ?? ""}
          />
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
      ) : null}

      <SwitchPrompt isSignUp />
    </div>
  )
}

function FormHeader({ isSignUp }: { isSignUp: boolean }) {
  return (
    <div className="grid justify-items-center gap-2 pb-1">
      <VenueMark
        name="Nabaperks"
        caption={isSignUp ? "New venue" : "Counter"}
      />
      <Eyebrow>{isSignUp ? "Open the till" : "Back to the counter"}</Eyebrow>
    </div>
  )
}

function SwitchPrompt({ isSignUp }: { isSignUp: boolean }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      {isSignUp ? "Already piloting?" : "New venue?"}{" "}
      <Link
        href={isSignUp ? "/login" : "/signup"}
        className="inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
      >
        {isSignUp ? "Log in" : "Start free pilot"}
      </Link>
    </p>
  )
}
