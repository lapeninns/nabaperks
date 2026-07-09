"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState, useEffect, useState } from "react"

import type { AuthActionState } from "@/app/(auth)/actions"
import { signUpAction } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import {
  PasswordRequirements,
} from "@/components/auth/password-requirements"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  validateConfirmPassword,
  validatePassword,
} from "@/lib/auth/password"
import { cn } from "@/lib/utils"

type SignupDetailsFormProps = {
  readonly initialEmail?: string
  readonly next?: string
}

const initialState: AuthActionState = {}

type ClientErrors = NonNullable<AuthActionState["errors"]>

export function SignupDetailsForm({
  initialEmail,
  next = "/app/onboarding",
}: SignupDetailsFormProps) {
  const [state, formAction] = useActionState(signUpAction, initialState)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [clientErrors, setClientErrors] = useState<ClientErrors>({})
  const [showValidation, setShowValidation] = useState(false)

  const shouldShowValidation = showValidation || Boolean(state.errors)
  const errors = mergeErrors(state.errors, clientErrors)

  useEffect(() => {
    if (!state.errors) return
    const firstInvalidId = [
      "name",
      "email",
      "password",
      "confirmPassword",
    ].find((key) => state.errors?.[key as keyof ClientErrors])
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
          const nextPassword = readPassword(formData, "password")
          const nextConfirmPassword = readPassword(formData, "confirmPassword")
          const nextErrors: ClientErrors = {}

          const name = readTrimmed(formData, "name")
          if (name.length < 2) nextErrors.name = "Enter your name."

          const email = readTrimmed(formData, "email").toLowerCase()
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            nextErrors.email = "Enter a valid email address."
          }

          const passwordError = validatePassword(nextPassword)
          if (passwordError) nextErrors.password = passwordError
          else {
            const confirmError = validateConfirmPassword(
              nextPassword,
              nextConfirmPassword
            )
            if (confirmError) nextErrors.confirmPassword = confirmError
          }

          setPassword(nextPassword)
          setConfirmPassword(nextConfirmPassword)
          setShowValidation(true)

          if (Object.keys(nextErrors).length) {
            event.preventDefault()
            setClientErrors(nextErrors)
            const firstInvalidId = [
              "name",
              "email",
              "password",
              "confirmPassword",
            ].find((key) => nextErrors[key as keyof ClientErrors])
            document.getElementById(firstInvalidId ?? "name")?.focus()
            return
          }

          setClientErrors({})
        }}
      >
        <AuthField
          id="name"
          label="Your name"
          description="The owner or operator running the venue. You add the business name and venue next."
          name="name"
          autoComplete="name"
          defaultValue={state.fields?.name}
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
        <div className="grid gap-2">
          <AuthField
            id="password"
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            error={errors.password}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              if (shouldShowValidation) {
                setClientErrors((current) => ({
                  ...current,
                  password: validatePassword(event.target.value) ?? undefined,
                  confirmPassword:
                    confirmPassword.length > 0
                      ? (validateConfirmPassword(
                          event.target.value,
                          confirmPassword
                        ) ?? undefined)
                      : current.confirmPassword,
                }))
              }
            }}
            onBlur={() => setShowValidation(true)}
          />
          <PasswordRequirements password={password} />
        </div>
        <AuthField
          id="confirmPassword"
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value)
            if (shouldShowValidation) {
              setClientErrors((current) => ({
                ...current,
                confirmPassword:
                  validateConfirmPassword(password, event.target.value) ??
                  undefined,
              }))
            }
          }}
          onBlur={() => setShowValidation(true)}
        />
        <input type="hidden" name="next" value={next} />
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
        Already piloting?{" "}
        <AuthPromptLink href="/login">Log in</AuthPromptLink>
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

function mergeErrors(
  serverErrors: AuthActionState["errors"],
  clientErrors: ClientErrors
): ClientErrors {
  return { ...clientErrors, ...serverErrors }
}

function readTrimmed(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function readPassword(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw : ""
}
