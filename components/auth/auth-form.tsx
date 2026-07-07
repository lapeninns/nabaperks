"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import { Eyebrow, VenueMark } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { merchantSignupVerifyHref } from "@/lib/navigation/merchant-auth-hrefs"
import { cn } from "@/lib/utils"

type AuthAction = (
  state: AuthActionState,
  formData: FormData
) => Promise<AuthActionState>

type AuthFormProps = {
  readonly action: AuthAction
  readonly mode: "sign-in"
  readonly next?: string
  readonly embedded?: boolean
}

const initialState: AuthActionState = {}

export function AuthForm({
  action,
  next: requestedNext,
  embedded = false,
}: AuthFormProps) {
  const next = requestedNext ?? "/app"

  return <SignInForm action={action} next={next} embedded={embedded} />
}

function SignInForm({
  action,
  next,
  embedded,
}: {
  readonly action: AuthAction
  readonly next: string
  readonly embedded: boolean
}) {
  const [state, formAction] = useActionState(action, initialState)

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
        {state.fields?.needsVerification && state.fields.email ? (
          <SwitchPromptLink
            href={merchantSignupVerifyHref({ email: state.fields.email })}
            className="justify-self-center"
          >
            Get a fresh code
          </SwitchPromptLink>
        ) : null}
        <SubmitButton pendingLabel="Opening…" className="w-full">
          Log in
        </SubmitButton>
      </form>
      <SwitchPrompt />
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

function SwitchPrompt() {
  return (
    <p className="text-center text-sm text-muted-foreground">
      New venue?{" "}
      <SwitchPromptLink href="/signup">Start free pilot</SwitchPromptLink>
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
