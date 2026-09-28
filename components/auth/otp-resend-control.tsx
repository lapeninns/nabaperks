"use client"

import type { ReactNode } from "react"

import { SubmitButton, type SubmitButtonProps } from "@/components/forms"
import { useOtpRetryCountdown } from "@/hooks/use-otp-retry-countdown"
import { cn } from "@/lib/utils"

// Moved to a shared hook so customer code steps can count down too; merchant
// imports from here keep working.
export { useOtpRetryCountdown }

type OtpResendControlProps = {
  readonly retryAt?: string
  readonly disabled?: boolean
  readonly buttonLabel?: string
  readonly pendingLabel?: ReactNode
  readonly helpText?: ReactNode
  readonly className?: string
  readonly variant?: SubmitButtonProps["variant"]
}

/**
 * Presentation for a server-owned OTP resend cooldown. The timestamp only
 * disables the client control for clarity; the server action remains the
 * authority when a request reaches it.
 */
export function OtpResendControl({
  retryAt,
  disabled = false,
  buttonLabel = "Resend code",
  pendingLabel = "Sending…",
  helpText,
  className,
  variant = "ghost",
}: OtpResendControlProps) {
  const countdown = useOtpRetryCountdown(retryAt)

  return (
    <div
      className={cn("grid gap-3", className)}
      data-cooldown-active={countdown.active ? "true" : "false"}
    >
      <SubmitButton
        pendingLabel={pendingLabel}
        variant={variant}
        className="w-full"
        disabled={disabled || countdown.active}
      >
        {countdown.active && countdown.ready
          ? `${buttonLabel} in ${countdown.remainingSeconds}s`
          : buttonLabel}
      </SubmitButton>

      {helpText ? (
        <p className="text-center text-xs leading-5 text-muted-foreground">
          {helpText}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {countdown.active
          ? "Resend wait started. You can request another code when the timer ends."
          : countdown.elapsed
            ? "You can request another code now."
            : ""}
      </p>
    </div>
  )
}
