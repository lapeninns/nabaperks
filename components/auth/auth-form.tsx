"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import { FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>
  verifyAction: (
    state: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>
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
  const [state, formAction, pending] = useActionState(action, initialState)
  const [verifyState, verifyFormAction, verifyPending] = useActionState(
    verifyAction,
    initialState
  )
  const isSignUp = mode === "sign-up"
  const next = requestedNext ?? (isSignUp ? "/app/onboarding" : "/app")
  const codeState = verifyState.fields?.otpSent ? verifyState : state
  const otpSent = Boolean(state.fields?.otpSent || verifyState.fields?.otpSent)

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        {embedded ? null : (
          <div className="grid justify-items-center gap-2 pb-1">
            <VenueMark
              name="Nabaperks"
              caption={isSignUp ? "New venue" : "Counter"}
            />
            <Eyebrow>
              {isSignUp ? "Open the till" : "Back to the counter"}
            </Eyebrow>
          </div>
        )}
        {isSignUp ? (
          <Field
            id="name"
            label="Your name"
            name="name"
            autoComplete="name"
            defaultValue={codeState.fields?.name}
            error={state.errors?.name}
          />
        ) : null}
        <Field
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={codeState.fields?.email}
          error={state.errors?.email}
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
          {pending ? "Sending..." : otpSent ? "Resend code" : "Send email code"}
        </Button>
      </form>

      {otpSent ? (
        <form action={verifyFormAction} className="grid gap-4">
          <input type="hidden" name="mode" value={mode} />
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
          <Field
            id="otp"
            label="Email code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
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
            {verifyPending
              ? "Checking..."
              : isSignUp
                ? "Continue setup"
                : "Open console"}
          </Button>
        </form>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already piloting?" : "New venue?"}{" "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        >
          {isSignUp ? "Log in" : "Start free pilot"}
        </Link>
      </p>
    </div>
  )
}

function Field({
  id,
  label,
  description,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  description?: string
  error?: string
}) {
  return (
    <FormField
      id={id}
      label={<Eyebrow>{label}</Eyebrow>}
      description={description}
      error={error}
    >
      <Input
        id={id}
        className={cn(
          "h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm",
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FormField>
  )
}
