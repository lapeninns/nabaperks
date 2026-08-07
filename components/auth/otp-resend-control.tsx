"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"

import { SubmitButton, type SubmitButtonProps } from "@/components/forms"
import { merchantOtpRetryCountdown } from "@/lib/auth/merchant-auth-action-state"
import { cn } from "@/lib/utils"

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
        // numeric-tabular: the label counts down every second, so proportional
        // digits made the button text jitter on each tick.
        className="numeric-tabular w-full"
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

export function useOtpRetryCountdown(retryAt: string | undefined) {
  const [clock, setClock] = useState(() => ({
    retryAt,
    now: undefined as number | undefined,
  }))
  const retryAtMs = retryAt ? Date.parse(retryAt) : Number.NaN
  const hasParsableRetryAt = Boolean(retryAt) && Number.isFinite(retryAtMs)
  const clockMatchesRetry = clock.retryAt === retryAt
  const ready =
    !hasParsableRetryAt || (clockMatchesRetry && typeof clock.now === "number")
  const countdown = !ready
    ? {
        active: true,
        remainingSeconds: 0,
      }
    : merchantOtpRetryCountdown(retryAt, clock.now ?? Number.NaN)

  useEffect(() => {
    if (!hasParsableRetryAt || ready) return

    const frame = window.requestAnimationFrame(() => {
      setClock({ retryAt, now: Date.now() })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hasParsableRetryAt, ready, retryAt])

  useEffect(() => {
    if (!ready || !countdown.active) return

    const interval = window.setInterval(
      () => setClock({ retryAt, now: Date.now() }),
      1_000
    )
    return () => window.clearInterval(interval)
  }, [countdown.active, ready, retryAt])

  return {
    ...countdown,
    ready,
    elapsed:
      ready &&
      clockMatchesRetry &&
      Boolean(retryAt) &&
      Number.isFinite(retryAtMs) &&
      retryAtMs <= (clock.now ?? Number.NaN),
  } as const
}
