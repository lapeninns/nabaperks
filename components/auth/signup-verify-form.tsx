"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useActionState, useEffect, useState } from "react"

import { signupOtpAction } from "@/app/(auth)/actions"
import { useMarketingFunnelToken } from "@/components/analytics/marketing-funnel-tracker"
import { AuthField } from "@/components/auth/auth-field"
import {
  OtpResendControl,
  useOtpRetryCountdown,
} from "@/components/auth/otp-resend-control"
import { Eyebrow } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  merchantOtpFocusTarget,
  merchantOtpFreshCodeRequiredAfter,
  merchantOtpInitialState,
  merchantOtpRequiresFreshCode,
} from "@/lib/auth/merchant-auth-action-state"
import {
  merchantLoginHref,
  merchantPasswordResetHref,
  merchantSignupHref,
} from "@/lib/navigation/merchant-auth-hrefs"
import { cn } from "@/lib/utils"

type SignupVerifyFormProps = {
  readonly email: string
  readonly name?: string
  readonly next?: string
  readonly otpLength: number
  readonly initialRetryAt?: string
}

type OtpIntent = "verify" | "resend"

export function SignupVerifyForm({
  email,
  name,
  next = "/app/onboarding",
  otpLength,
  initialRetryAt,
}: SignupVerifyFormProps) {
  const [otp, setOtp] = useState("")
  const [lastIntent, setLastIntent] = useState<OtpIntent | null>(null)
  const [savedResendRetryAt, setSavedResendRetryAt] = useState(initialRetryAt)
  const [requiresFreshCode, setRequiresFreshCode] = useState(false)
  const funnelToken = useMarketingFunnelToken()

  async function dispatchOtpAction(
    previousState: Parameters<typeof signupOtpAction>[0],
    formData: FormData
  ) {
    const result = await signupOtpAction(previousState, formData)
    if (result.outcome === "sent") {
      setOtp("")
    } else if (merchantOtpRequiresFreshCode(result.outcome)) {
      setOtp("")
    }
    setRequiresFreshCode((current) =>
      merchantOtpFreshCodeRequiredAfter(current, result.outcome)
    )
    return result
  }

  const [state, formAction, pending] = useActionState(
    dispatchOtpAction,
    merchantOtpInitialState({
      flow: "signup",
      step: "verify",
      email,
      name,
      next,
    })
  )

  const currentEmail = state.context.email
  const currentName = state.context.name ?? ""
  const currentNext = state.context.next
  const verifyRetryAt =
    lastIntent === "verify" &&
    (state.outcome === "busy" || state.outcome === "throttled")
      ? state.retryAt
      : undefined
  const verifyCountdown = useOtpRetryCountdown(verifyRetryAt)
  const resendRetryAt =
    lastIntent === "resend"
      ? (state.retryAt ?? savedResendRetryAt)
      : savedResendRetryAt

  useEffect(() => {
    const target =
      state.outcome === "idle" ? "otp" : merchantOtpFocusTarget(state.outcome)
    if (!target) return

    const animationFrame = window.requestAnimationFrame(() => {
      document
        .getElementById(target === "otp" ? "otp" : "signup-otp-recovery")
        ?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [state])

  function rememberIntent(intent: OtpIntent) {
    if (lastIntent === "resend" && state.retryAt) {
      setSavedResendRetryAt(state.retryAt)
    }
    setLastIntent(intent)
  }

  const correctionHref = merchantSignupHref({
    email: currentEmail,
    name: currentName,
    next: currentNext,
  })
  const formError = state.errors?.form ?? state.errors?.email

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border-2 border-dashed border-border bg-secondary/55 px-3 py-2">
        <Eyebrow>Email address</Eyebrow>
        <p className="text-sm leading-6 font-extrabold break-words">
          {currentEmail}
        </p>
      </div>

      <form
        action={formAction}
        onSubmit={() => rememberIntent("verify")}
        className="grid gap-4"
      >
        <OtpContextFields
          intent="verify"
          email={currentEmail}
          name={currentName}
          next={currentNext}
          funnelToken={funnelToken}
        />
        <AuthField
          id="otp"
          label="Email code"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          enterKeyHint="done"
          maxLength={otpLength}
          value={otp}
          onChange={(event) =>
            setOtp(
              event.currentTarget.value.replace(/\D/g, "").slice(0, otpLength)
            )
          }
          onPaste={(event) => {
            const pastedOtp = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, otpLength)
            if (!pastedOtp) return
            event.preventDefault()
            setOtp(pastedOtp)
          }}
          className="font-mono tracking-[0.18em]"
          error={state.errors?.otp}
        />
        <SubmitButton
          pendingLabel="Checking…"
          className="w-full"
          disabled={
            pending ||
            requiresFreshCode ||
            merchantOtpRequiresFreshCode(state.outcome) ||
            verifyCountdown.active
          }
        >
          {verifyCountdown.active && verifyCountdown.ready
            ? `Try again in ${verifyCountdown.remainingSeconds}s`
            : "Verify email"}
        </SubmitButton>
      </form>

      {formError ? (
        <Alert
          id="signup-otp-recovery"
          role="alert"
          tabIndex={-1}
          variant="destructive"
        >
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {state.outcome === "sent" && state.message ? (
        <Alert
          id="signup-otp-sent"
          role="status"
          aria-live="polite"
          className="bg-accent"
        >
          <AlertDescription className="text-accent-foreground">
            {state.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={formAction}
        onSubmit={() => rememberIntent("resend")}
        aria-label="Request another verification email"
        className="grid gap-3"
      >
        <OtpContextFields
          intent="resend"
          email={currentEmail}
          name={currentName}
          next={currentNext}
          funnelToken={funnelToken}
        />
        <OtpResendControl
          retryAt={resendRetryAt}
          disabled={pending}
          helpText={
            <>
              Codes arrive in under a minute. No email? Check your spam or junk
              folder, then resend.
            </>
          }
        />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Wrong email?{" "}
        <AuthPromptLink href={correctionHref}>Back to sign up</AuthPromptLink>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Used this email before?{" "}
        <AuthPromptLink
          href={merchantLoginHref({ email: currentEmail, next: currentNext })}
        >
          Log in
        </AuthPromptLink>{" "}
        or{" "}
        <AuthPromptLink
          href={merchantPasswordResetHref({
            email: currentEmail,
            next: currentNext,
          })}
        >
          request a sign-in code
        </AuthPromptLink>
      </p>
    </div>
  )
}

function OtpContextFields({
  intent,
  email,
  name,
  next,
  funnelToken,
}: {
  readonly intent: OtpIntent
  readonly email: string
  readonly name: string
  readonly next: string
  readonly funnelToken?: string | null
}) {
  return (
    <>
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="funnelToken" value={funnelToken ?? ""} />
    </>
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
