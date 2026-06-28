"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { Eyebrow, VenueMark } from "@/components/brand"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type AuthAction = (
  state: AuthActionState,
  formData: FormData
) => Promise<AuthActionState>

type AuthFormProps = {
  action: AuthAction
  verifyAction?: AuthAction
  mode: "sign-in" | "sign-up"
  next?: string
  embedded?: boolean
}

const initialState: AuthActionState = {}

export function AuthForm({
  action,
  verifyAction,
  mode,
  next: requestedNext,
  embedded = false,
}: AuthFormProps) {
  const isSignUp = mode === "sign-up"
  const next = requestedNext ?? (isSignUp ? "/app/onboarding" : "/app")

  return isSignUp ? (
    <SignUpForm
      action={action}
      verifyAction={verifyAction ?? action}
      next={next}
      embedded={embedded}
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
  const [state, formAction, pending] = useActionState(action, initialState)

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
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/10"
          >
            <AlertDescription>{state.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Opening..." : "Log in"}
        </Button>
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
}: {
  action: AuthAction
  verifyAction: AuthAction
  next: string
  embedded: boolean
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    verifyAction,
    initialState
  )
  const codeState = verifyState.fields?.otpSent ? verifyState : state
  const otpSent = Boolean(state.fields?.otpSent || verifyState.fields?.otpSent)

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
        <input type="hidden" name="next" value={next} />
        {state.errors?.form ? (
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/10"
          >
            <AlertDescription>{state.errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {state.message ? (
          <Alert className="border-reward/30 bg-accent">
            <AlertDescription className="text-accent-foreground">
              {state.message}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending..." : otpSent ? "Resend code" : "Create account"}
        </Button>
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
            maxLength={4}
            className="font-mono tracking-[0.18em]"
            error={verifyState.errors?.otp}
          />
          {verifyState.errors?.form ? (
            <Alert
              variant="destructive"
              className="border-destructive/30 bg-destructive/10"
            >
              <AlertDescription>{verifyState.errors.form}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={verifyPending} className="w-full">
            {verifyPending ? "Checking..." : "Verify email"}
          </Button>
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
