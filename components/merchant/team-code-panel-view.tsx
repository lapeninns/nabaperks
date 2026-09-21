"use client"

import { useId, useState } from "react"

import type {
  resetVenueCodeAction,
  VenueCodeResetActionState,
} from "@/app/app/actions"
import { recordConsoleEventAction } from "@/app/app/console-events"
import { ReceiptCard } from "@/components/brand"
import { formatCodeRotation } from "@/lib/merchant/team-code-rotation"

import { ResetCodeSheet } from "./reset-code-sheet"

export type TeamCodePanelViewProps = {
  readonly code: string | null
  readonly rotatesAt: string | null
  /** Reference time for the rotation label; a literal in the harness. */
  readonly nowIso: string
  /** False hides the reset link entirely (never shown-and-disabled). */
  readonly rotationAvailable?: boolean
  readonly initialRevealed?: boolean
  readonly resetAction?: typeof resetVenueCodeAction
}

/**
 * One `aria-expanded` disclosure carrying the masked or revealed code, the
 * rotation line and one sentence of explanation. A console left open on the
 * bar is a console anyone can read, so the reveal is a deliberate tap; the
 * digits are spelled out for screen readers instead of read as a number.
 * Resetting opens `ResetCodeSheet`; success reveals the new code, stamps
 * the panel with the reset time and toasts, never silently.
 */
export function TeamCodePanelView({
  code: initialCode,
  rotatesAt: initialRotatesAt,
  nowIso,
  rotationAvailable = true,
  initialRevealed = false,
  resetAction,
}: TeamCodePanelViewProps) {
  const [code, setCode] = useState(initialCode)
  const [rotatesAt, setRotatesAt] = useState(initialRotatesAt)
  const [revealed, setRevealed] = useState(initialRevealed)
  const [resetStamp, setResetStamp] = useState<string | null>(null)
  const codeId = useId()

  const spelled = code ? code.split("").join(" ") : ""
  const rotationLabel = rotatesAt
    ? formatCodeRotation(rotatesAt, new Date(nowIso))
    : "Changes daily at 5am"

  function toggle() {
    const next = !revealed
    setRevealed(next)
    if (next) {
      void recordConsoleEventAction({
        name: "team_code_revealed",
        properties: {},
      })
    }
  }

  function handleReset(state: VenueCodeResetActionState) {
    if (state.code) setCode(state.code)
    if (state.rotatesAt) setRotatesAt(state.rotatesAt)
    setRevealed(true)
    setResetStamp(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date())
    )
  }

  return (
    <ReceiptCard edge className="grid gap-3" data-team-code-panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono-meta text-ink-soft">Team code</p>
        {resetStamp ? (
          <p className="mono-id text-ink-soft" data-team-code-reset-stamp>
            Reset {resetStamp}
          </p>
        ) : null}
      </div>

      {code ? (
        <button
          type="button"
          aria-expanded={revealed}
          aria-controls={codeId}
          onClick={toggle}
          className="pressable grid w-full gap-1 rounded-lg border-2 border-ink bg-paper-deep/50 px-4 py-3 text-left shadow-xs active:shadow-2xs"
        >
          <span
            id={codeId}
            data-venue-code={revealed ? "shown" : "hidden"}
            aria-label={
              revealed ? `Today's code, ${spelled}` : "Today's code, hidden"
            }
            className="block pl-[0.26em] font-mono text-[1.875rem] leading-none font-bold tracking-[0.26em] tabular-nums"
          >
            {revealed ? code : "••••••"}
          </span>
          <span className="mono-meta text-ink-soft">
            {revealed ? "Tap to hide" : "Tap to reveal"}
          </span>
        </button>
      ) : (
        <p
          data-venue-code="unavailable"
          className="rounded-lg border-2 border-dashed border-line-strong bg-paper-deep/40 p-3 text-sm leading-5 font-bold text-muted-foreground"
        >
          Today&apos;s code isn&apos;t available right now. Refresh in a moment.
        </p>
      )}

      <p className="mono-meta text-ink-soft">{rotationLabel}</p>
      <p className="text-sm leading-6 text-muted-foreground">
        If a member&apos;s phone can&apos;t confirm they&apos;re here, read them
        this code. They type it on their own phone and today&apos;s stamp lands
        as normal.
      </p>

      {rotationAvailable && code ? (
        <ResetCodeSheet action={resetAction} onReset={handleReset}>
          <button
            type="button"
            className="focus-ring inline-flex min-h-11 w-fit items-center text-sm font-bold text-foreground underline underline-offset-4"
          >
            Reset the code
          </button>
        </ResetCodeSheet>
      ) : null}
    </ReceiptCard>
  )
}
