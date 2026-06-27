"use client"

import Link from "next/link"
import { useActionState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { Eyebrow, VenueMark } from "@/components/brand"
import { FormField } from "@/components/forms/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AuthFormProps = {
  action: (
    state: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>
  mode: "sign-in" | "sign-up"
  next?: string
  /** Hide the in-form brand block when the page already provides context. */
  embedded?: boolean
}

const initialState: AuthActionState = {}

export function AuthForm({
  action,
  mode,
  next = "/app",
  embedded = false,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const isSignUp = mode === "sign-up"

  return (
    <form action={formAction} className="grid gap-4">
      {embedded ? null : (
        <div className="grid justify-items-center gap-2 pb-1">
          <VenueMark
            name="Nabaperks"
            caption={isSignUp ? "New venue" : "Counter"}
          />
          <Eyebrow>{isSignUp ? "Open the till" : "Back to the counter"}</Eyebrow>
        </div>
      )}
      {isSignUp ? (
        <Field
          id="name"
          label="Your name"
          name="name"
          autoComplete="name"
          defaultValue={state.fields?.name}
          error={state.errors?.name}
        />
      ) : null}
      <Field
        id="email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.fields?.email}
        error={state.errors?.email}
      />
      <Field
        id="password"
        label="Password"
        name="password"
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        description={isSignUp ? "At least 8 characters." : undefined}
        error={state.errors?.password}
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
        {pending ? "Working..." : isSignUp ? "Start free pilot" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already piloting?" : "New venue?"}{" "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        >
          {isSignUp ? "Log in" : "Start free pilot"}
        </Link>
      </p>
    </form>
  )
}

function Field({
  id,
  label,
  description,
  error,
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
        className="h-12 rounded-xl border-2 border-ink bg-secondary/60 px-4 text-sm"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
    </FormField>
  )
}
