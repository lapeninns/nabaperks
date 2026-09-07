"use client"

import { useActionState, useId, useState } from "react"

import {
  resetVenueCodeAction,
  type VenueCodeResetActionState,
} from "@/app/app/actions"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

const initialResetState: VenueCodeResetActionState = {}

/**
 * The code itself, hidden behind a tap. A dashboard left open on the bar is a
 * dashboard anyone can read; the reveal is a small, deliberate act and the
 * digits are spelled out for screen readers instead of read as a number.
 */
export function VenueCodeReveal({ code }: { code: string }) {
  const [shown, setShown] = useState(false)
  const spelled = code.split("").join(" ")

  return (
    <div className="grid gap-2">
      <p
        data-venue-code={shown ? "shown" : "hidden"}
        className="mono-id text-4xl tracking-[0.3em] tabular-nums"
        aria-label={shown ? `Today's code, ${spelled}` : "Today's code, hidden"}
      >
        {shown ? code : "••••••"}
      </p>
      <Button
        type="button"
        variant={shown ? "ghost" : "outline"}
        size="sm"
        className="w-fit"
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        {shown ? "Hide code" : "Show code"}
      </Button>
    </div>
  )
}

/**
 * Reset form. The attestation checkbox gates submit so a stray tap never
 * changes the code mid-service without the team knowing.
 */
export function VenueCodeResetForm({
  action = resetVenueCodeAction,
}: {
  action?: typeof resetVenueCodeAction
}) {
  const [state, formAction, pending] = useActionState(action, initialResetState)
  const [confirmed, setConfirmed] = useState(false)
  const checkboxId = useId()

  return (
    <form action={formAction} className="grid gap-3">
      {state.errors?.form ? (
        <StatusBanner tone="warning" title="Code not reset">
          {state.errors.form}
        </StatusBanner>
      ) : null}
      {state.reset ? (
        <StatusBanner tone="success" title="Code reset">
          Today&apos;s code has changed. Tell the team the new one.
        </StatusBanner>
      ) : null}
      <fieldset disabled={pending} className="grid gap-3">
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-3 text-sm leading-6"
        >
          <input
            id={checkboxId}
            type="checkbox"
            name="confirmReset"
            value="true"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 size-5 shrink-0 accent-primary"
          />
          <span>
            I&apos;ll tell the team the new code. The old one stops working
            straight away.
          </span>
        </label>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={pending || !confirmed}
        >
          {pending ? "Resetting…" : "Reset code"}
        </Button>
      </fieldset>
    </form>
  )
}
