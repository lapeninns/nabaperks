"use client"

import { useEffect, useState } from "react"

import { merchantOtpRetryCountdown } from "@/lib/auth/merchant-auth-action-state"

/**
 * A live countdown to a server-owned OTP resend time (ISO string). Shared by
 * the merchant auth forms and the customer code steps. The timestamp only
 * disables the client control for clarity; the server action remains the
 * authority when a request reaches it. The first client frame reads the clock,
 * so the server render and hydration agree.
 */
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
