"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState, useEffect } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { signUpAction } from "@/app/(auth)/actions"
import {
  captureMarketingFunnelEvent,
  useMarketingFunnelToken,
} from "@/components/analytics/marketing-funnel-tracker"
import { AuthField } from "@/components/auth/auth-field"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { merchantLoginHref } from "@/lib/navigation/merchant-auth-hrefs"
import { cn } from "@/lib/utils"

type SignupDetailsFormProps = {
  readonly initialEmail?: string
  readonly initialName?: string
  readonly next?: string
}

const initialState: AuthActionState = {}

type ClientErrors = NonNullable<AuthActionState["errors"]>

export function SignupDetailsForm({
  initialEmail,
  initialName,
  next = "/app/onboarding",
}: SignupDetailsFormProps) {
  const [state, formAction] = useActionState(signUpAction, initialState)
  const funnelToken = useMarketingFunnelToken()

  const errors = state.errors ?? {}

  useEffect(() => {
    if (!state.errors) return
    const firstInvalidId = ["name", "email"].find(
      (key) => state.errors?.[key as keyof ClientErrors]
    )
    const target = firstInvalidId
      ? document.getElementById(firstInvalidId)
      : null
    if (target instanceof HTMLElement) target.focus()
  }, [state])

  return (
    <div className="grid gap-4">
      <form
        action={formAction}
        className="grid gap-4"
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget)
          const nextErrors: ClientErrors = {}

          const name = readTrimmed(formData, "name")
          if (name.length < 2) nextErrors.name = "Enter your name."

          const email = readTrimmed(formData, "email").toLowerCase()
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            nextErrors.email = "Enter a valid email address."
          }

          if (Object.keys(nextErrors).length) {
            event.preventDefault()
            const firstInvalidId = ["name", "email"].find(
              (key) => nextErrors[key as keyof ClientErrors]
            )
            document.getElementById(firstInvalidId ?? "name")?.focus()
            return
          }

          void captureMarketingFunnelEvent("merchant_signup_started")
        }}
      >
        <AuthField
          id="name"
          label="Your name"
          description="The owner or operator approving the launch. We ask for the pub details next."
          name="name"
          autoComplete="name"
          defaultValue={state.fields?.name ?? initialName}
          error={errors.name}
        />
        <AuthField
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.fields?.email ?? initialEmail}
          error={errors.email}
        />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="funnelToken" value={funnelToken ?? ""} />
        {errors.form ? (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        ) : null}
        <SubmitButton pendingLabel="Sending…" className="w-full">
          Create account
        </SubmitButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <AuthPromptLink
          href={merchantLoginHref({
            email: state.fields?.email ?? initialEmail,
            next,
          })}
        >
          Log in
        </AuthPromptLink>
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

function readTrimmed(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}
