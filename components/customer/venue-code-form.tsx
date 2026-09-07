"use client"

import { useId, useState } from "react"

import { customerInputClass } from "@/components/customer/input-class"
import { Button } from "@/components/ui/button"

export const VENUE_CODE_LENGTH = 6

const LOCK_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/London",
})

export type VenueCodeFormProps = {
  /** Tries left before a lockout, when the last code was wrong. */
  attemptsRemaining: number | null
  /** ISO time the lockout lifts; while it is in the future the input is withheld. */
  lockedUntil: string | null
  /** A stamp request is in flight — the form is inert until it settles. */
  pending: boolean
  onSubmit: (code: string) => void
}

/**
 * The venue-code fallback beneath a refused location check. A team member
 * reads today's six-digit code out; the customer types it here. Server-side
 * the code is only honoured shortly after a recorded refusal, so the form is
 * deliberately plain: one numeric field, one button, no explanation of what
 * the code proves.
 */
export function VenueCodeForm({
  attemptsRemaining,
  lockedUntil,
  pending,
  onSubmit,
}: VenueCodeFormProps) {
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const [code, setCode] = useState("")
  const complete = code.length === VENUE_CODE_LENGTH

  // The server decides whether the membership is locked out; this component
  // only names the time. A customer who waits it out taps the stamp again,
  // and the next refusal offers the input afresh.
  if (lockedUntil) {
    const lockedUntilTime = new Date(lockedUntil)
    return (
      <p
        data-venue-code-locked
        className="rounded-lg bg-secondary px-3 py-2 text-center text-sm leading-5 font-medium text-ink-soft"
      >
        Too many tries. Ask a team member, then try again after{" "}
        {LOCK_TIME_FORMAT.format(lockedUntilTime)}.
      </p>
    )
  }

  return (
    <form
      data-venue-code-form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending || !complete) return
        onSubmit(code)
        setCode("")
      }}
    >
      <label htmlFor={inputId} className="text-sm leading-5 font-bold">
        Today&apos;s code from a team member
      </label>
      <fieldset disabled={pending} className="grid gap-2">
        <input
          id={inputId}
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={VENUE_CODE_LENGTH}
          value={code}
          onChange={(event) => {
            setCode(
              event.target.value.replace(/\D/g, "").slice(0, VENUE_CODE_LENGTH)
            )
          }}
          aria-describedby={hintId}
          aria-invalid={attemptsRemaining !== null ? true : undefined}
          className={`${customerInputClass} w-full text-center font-mono text-xl tracking-[0.35em] md:text-xl`}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || !complete}
        >
          Add my stamp
        </Button>
      </fieldset>
      <p
        id={hintId}
        className="text-xs leading-5 text-muted-foreground"
        aria-live="polite"
      >
        {attemptsRemaining === null
          ? "Six digits. It changes every day."
          : attemptsRemaining === 1
            ? "1 try left before a short lockout."
            : `${attemptsRemaining} tries left before a short lockout.`}
      </p>
    </form>
  )
}
