"use client"

import Link from "next/link"
import { useActionState, useCallback, useEffect, useRef, useState } from "react"

import { passwordResetAction } from "@/app/(auth)/actions"
import { AuthField } from "@/components/auth/auth-field"
import {
  OtpResendControl,
  useOtpRetryCountdown,
} from "@/components/auth/otp-resend-control"
import { PasswordRequirements } from "@/components/auth/password-requirements"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  merchantOtpFocusTarget,
  merchantOtpFreshCodeRequiredAfter,
  merchantOtpInitialState,
  merchantOtpRequiresFreshCode,
  type MerchantOtpActionState,
} from "@/lib/auth/merchant-auth-action-state"
import { validateConfirmPassword, validatePassword } from "@/lib/auth/password"
import {
  merchantLoginHref,
  merchantPasswordResetHref,
  merchantPasswordResetVerifyHref,
} from "@/lib/navigation/merchant-auth-hrefs"

type ResetPasswordFormProps = {
  readonly otpLength: number
  readonly initialEmail?: string
  readonly initialOtpSent?: boolean
  readonly initialRetryAt?: string
  readonly next?: string
}

type ResetClientErrors = Readonly<{
  otp?: string
  password?: string
  confirmPassword?: string
}>

type ResetIntent = "request" | "resend" | "confirm"

export function ResetPasswordForm({
  otpLength,
  initialEmail = "",
  initialOtpSent = false,
  initialRetryAt,
  next = "/app",
}: ResetPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [otp, setOtp] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [clientErrors, setClientErrors] = useState<ResetClientErrors>({})
  const [showPasswordValidation, setShowPasswordValidation] = useState(false)
  const [resendRetryAt, setResendRetryAt] = useState(initialRetryAt)
  const [requiresFreshCode, setRequiresFreshCode] = useState(false)
  const [lastIntent, setLastIntent] = useState<ResetIntent | null>(null)
  const recoveryRef = useRef<HTMLDivElement>(null)
  const dispatchPasswordReset = useCallback(
    async (previousState: MerchantOtpActionState, formData: FormData) => {
      const intent = resetIntent(formData)
      setLastIntent(intent)
      const nextState = await passwordResetAction(previousState, formData)

      if (nextState.outcome === "sent") {
        setOtp("")
        setClientErrors({})
        setShowPasswordValidation(false)
        setResendRetryAt(nextState.retryAt)
      } else if (intent !== "confirm" && nextState.retryAt !== undefined) {
        setResendRetryAt(nextState.retryAt)
      }
      setRequiresFreshCode((current) =>
        merchantOtpFreshCodeRequiredAfter(current, nextState.outcome)
      )
      if (merchantOtpRequiresFreshCode(nextState.outcome)) {
        setOtp("")
      }

      return nextState
    },
    []
  )
  const [state, formAction, pending] = useActionState(
    dispatchPasswordReset,
    merchantOtpInitialState({
      flow: "recovery",
      step: initialOtpSent ? "verify" : "request",
      email: initialEmail.trim().toLowerCase(),
      next,
    })
  )

  const otpSent = initialOtpSent || state.context.step === "verify"
  const currentEmail = otpSent ? state.context.email || email : email
  const errors = { ...state.errors, ...clientErrors }
  const verificationRetryAt =
    state.outcome === "busy" ||
    (state.outcome === "throttled" && lastIntent === "confirm")
      ? state.retryAt
      : undefined
  const verificationWait = useOtpRetryCountdown(verificationRetryAt)
  const confirmationDisabled =
    pending ||
    requiresFreshCode ||
    merchantOtpRequiresFreshCode(state.outcome) ||
    verificationWait.active
  const shouldShowPasswordValidation =
    showPasswordValidation || Boolean(state.errors)

  useEffect(() => {
    if (state.outcome === "sent") {
      window.history.replaceState(
        window.history.state,
        "",
        merchantPasswordResetVerifyHref({
          email: state.context.email,
          next: state.context.next,
        })
      )
    }

    const focusTarget = merchantOtpFocusTarget(state.outcome)
    if (focusTarget === "otp") {
      document.getElementById(otpSent ? "otp" : "email")?.focus()
    } else if (focusTarget === "recovery") {
      recoveryRef.current?.focus()
    }
  }, [otpSent, state])

  return (
    <div className="grid gap-4">
      {!otpSent ? (
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="intent" value="request" />
          <input type="hidden" name="next" value={state.context.next} />
          <AuthField
            id="email"
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={currentEmail}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
          />
          <div
            ref={recoveryRef}
            id="reset-request-recovery"
            role="group"
            aria-label="Reset-code recovery options"
            tabIndex={-1}
            className="focus-target grid gap-3 rounded-lg"
          >
            {errors.form ? <ErrorFeedback message={errors.form} /> : null}
            <OtpResendControl
              retryAt={resendRetryAt}
              disabled={pending}
              variant="default"
              buttonLabel="Send reset code"
            />
          </div>
        </form>
      ) : (
        <>
          <form
            action={formAction}
            className="grid gap-4"
            onSubmit={(event) => {
              const nextErrors = validateConfirmation({
                otp,
                otpLength,
                password,
                confirmPassword,
              })
              setShowPasswordValidation(true)

              if (Object.keys(nextErrors).length > 0) {
                event.preventDefault()
                setClientErrors(nextErrors)
                focusFirstError(nextErrors)
                return
              }

              setClientErrors({})
            }}
          >
            <input type="hidden" name="intent" value="confirm" />
            <input type="hidden" name="next" value={state.context.next} />
            <AuthField
              id="email"
              label="Venue email"
              name="email"
              type="email"
              autoComplete="email"
              value={currentEmail}
              readOnly
              error={errors.email}
            />
            <AuthField
              id="otp"
              label="Reset code"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus={initialOtpSent}
              maxLength={otpLength}
              className="font-mono tracking-code"
              value={otp}
              onChange={(event) => {
                setOtp(
                  event.target.value.replace(/\D/g, "").slice(0, otpLength)
                )
                if (clientErrors.otp) {
                  setClientErrors((current) => ({
                    ...current,
                    otp: undefined,
                  }))
                }
              }}
              onPaste={(event) => {
                const pastedOtp = event.clipboardData
                  .getData("text")
                  .replace(/\D/g, "")
                  .slice(0, otpLength)
                if (!pastedOtp) return
                event.preventDefault()
                setOtp(pastedOtp)
                setClientErrors((current) => ({
                  ...current,
                  otp: undefined,
                }))
              }}
              error={errors.otp}
            />
            <div className="grid gap-2">
              <AuthField
                id="password"
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                aria-describedby="reset-password-requirements"
                value={password}
                onChange={(event) => {
                  const nextPassword = event.target.value
                  setPassword(nextPassword)
                  if (shouldShowPasswordValidation) {
                    setClientErrors((current) => ({
                      ...current,
                      password: validatePassword(nextPassword) ?? undefined,
                      confirmPassword:
                        confirmPassword.length > 0
                          ? (validateConfirmPassword(
                              nextPassword,
                              confirmPassword
                            ) ?? undefined)
                          : current.confirmPassword,
                    }))
                  }
                }}
                onBlur={() => setShowPasswordValidation(true)}
                error={errors.password}
              />
              <PasswordRequirements
                id="reset-password-requirements"
                password={password}
              />
            </div>
            <AuthField
              id="confirmPassword"
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                const nextConfirmation = event.target.value
                setConfirmPassword(nextConfirmation)
                if (shouldShowPasswordValidation) {
                  setClientErrors((current) => ({
                    ...current,
                    confirmPassword:
                      validateConfirmPassword(password, nextConfirmation) ??
                      undefined,
                  }))
                }
              }}
              onBlur={() => setShowPasswordValidation(true)}
              error={errors.confirmPassword}
            />
            <SubmitButton
              pendingLabel="Saving…"
              className="w-full"
              disabled={confirmationDisabled}
            >
              Set new password
            </SubmitButton>
          </form>

          <div
            ref={recoveryRef}
            id="recovery"
            role="group"
            aria-label="Code recovery options"
            tabIndex={-1}
            className="focus-target grid gap-3 rounded-lg"
          >
            {errors.form ? <ErrorFeedback message={errors.form} /> : null}
            {state.message ? <SuccessFeedback message={state.message} /> : null}
            {verificationWait.active && verificationWait.ready ? (
              <p className="numeric-tabular text-center text-xs leading-5 font-semibold text-muted-foreground">
                Try this code again in {verificationWait.remainingSeconds}s.
              </p>
            ) : null}
            <form
              action={formAction}
              aria-label="Request another password-reset email"
              className="grid gap-3"
            >
              <input type="hidden" name="intent" value="resend" />
              <input type="hidden" name="email" value={currentEmail} />
              <input type="hidden" name="next" value={state.context.next} />
              <OtpResendControl
                retryAt={resendRetryAt}
                disabled={pending}
                buttonLabel="Resend reset code"
                helpText="No email? Check spam or junk, then request another code when the timer ends."
              />
            </form>
            <p className="text-center text-sm text-muted-foreground">
              Wrong email?{" "}
              <Link
                href={merchantPasswordResetHref({
                  email: currentEmail,
                  next: state.context.next,
                })}
                className="focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"
              >
                Use a different email
              </Link>
            </p>
          </div>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href={merchantLoginHref({
            email: currentEmail,
            next: state.context.next,
          })}
          className="focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </div>
  )
}

function validateConfirmation({
  otp,
  otpLength,
  password,
  confirmPassword,
}: {
  otp: string
  otpLength: number
  password: string
  confirmPassword: string
}): ResetClientErrors {
  const errors: {
    otp?: string
    password?: string
    confirmPassword?: string
  } = {}
  const normalizedOtp = otp.replace(/\s+/g, "")

  if (!new RegExp(`^\\d{${otpLength}}$`).test(normalizedOtp)) {
    errors.otp = `Enter the ${otpLength}-digit code from your email.`
  }

  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError
  else {
    const confirmError = validateConfirmPassword(password, confirmPassword)
    if (confirmError) errors.confirmPassword = confirmError
  }

  return errors
}

function resetIntent(formData: FormData): ResetIntent {
  const intent = formData.get("intent")
  return intent === "resend" || intent === "confirm" ? intent : "request"
}

function focusFirstError(errors: ResetClientErrors) {
  const target = ["otp", "password", "confirmPassword"].find(
    (field) => errors[field as keyof ResetClientErrors]
  )
  document.getElementById(target ?? "otp")?.focus()
}

function ErrorFeedback({ message }: { readonly message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function SuccessFeedback({ message }: { readonly message: string }) {
  return (
    <Alert role="status" aria-live="polite" className="bg-accent">
      <AlertDescription className="text-accent-foreground">
        {message}
      </AlertDescription>
    </Alert>
  )
}
