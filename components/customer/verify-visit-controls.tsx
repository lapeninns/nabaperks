"use client"

import { useEffect, useRef, useState } from "react"

import { LocationPermissionHelp } from "@/components/customer/location-permission-help"
import { Button } from "@/components/ui/button"
import {
  resolveStampLocation,
  type StampLocationCapture,
} from "@/lib/customer/stamp-location-capture"
import type { StampLocationIssue } from "@/lib/customer/stamp-location-recovery"

/** After this long without an answer the hint says so; the wait itself goes on. */
const SLOW_FIX_HINT_MS = 10_000

export type VerifyVisitControlsProps = {
  /** A stamp request is in flight or the card is secured — neither control may start anything. */
  disabled: boolean
  recoveryIssue?: StampLocationIssue
  retry?: boolean
  graceRemaining?: number
  onUseGrace: () => void
  /** The code form is already open beneath, so its button is redundant. */
  codeOpen: boolean
  /** The browser answered (a fix, a refusal, or a timeout). Never called for a cancelled wait. */
  onCapture: (capture: StampLocationCapture) => void
  /** The customer chose the code. An in-flight location wait is abandoned first. */
  onOpenCode: () => void
  /** Mirrors the wait so the stamp screen can say "checking your location" without inking the card. */
  onAcquiringChange: (acquiring: boolean) => void
}

/**
 * The two ways a visit from the third onwards can be confirmed, side by side
 * before anything has been refused. "Use my location" is the only thing that
 * asks the browser for a fix — never page load, never the stamp press — so a
 * customer who has since allowed location in site settings gets a real
 * reading on the tap. "Enter venue code" opens the six-digit form without a
 * failed location attempt first.
 */
export function VerifyVisitControls({
  disabled,
  recoveryIssue,
  retry,
  graceRemaining,
  onUseGrace,
  codeOpen,
  onCapture,
  onOpenCode,
  onAcquiringChange,
}: VerifyVisitControlsProps) {
  const [acquiring, setAcquiring] = useState(false)
  const [slow, setSlow] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function askForLocation() {
    if (disabled || abortRef.current) return
    const controller = new AbortController()
    abortRef.current = controller
    setAcquiring(true)
    setSlow(false)
    onAcquiringChange(true)
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_FIX_HINT_MS)

    try {
      const capture = await resolveStampLocation(
        true,
        undefined,
        controller.signal
      )
      if (capture && !controller.signal.aborted) onCapture(capture)
    } finally {
      window.clearTimeout(slowTimer)
      if (abortRef.current === controller) {
        abortRef.current = null
        setAcquiring(false)
        setSlow(false)
        onAcquiringChange(false)
      }
    }
  }

  function openCode() {
    abortRef.current?.abort()
    onOpenCode()
  }

  const hint =
    acquiring && slow
      ? "Taking longer than expected. Keep waiting, or enter today's venue code."
      : null

  return (
    <div data-verify-visit className="grid gap-2">
      <Button
        type="button"
        size="lg"
        className="w-full hover:bg-primary"
        disabled={disabled || acquiring}
        onClick={() => {
          void askForLocation()
        }}
        data-use-location
      >
        {acquiring
          ? "Checking location"
          : retry
            ? "Try Again"
            : "Use my location"}
      </Button>
      {recoveryIssue === "denied" ? <LocationPermissionHelp /> : null}
      {recoveryIssue ? (
        <p className="text-sm leading-5 text-muted-foreground">
          No stamp added. You can also ask a team member for today&apos;s venue
          code.
        </p>
      ) : null}
      {codeOpen ? null : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={disabled}
          onClick={openCode}
          data-enter-venue-code
        >
          Enter venue code
        </Button>
      )}
      {recoveryIssue && (graceRemaining ?? 0) > 0 ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2">
            Can&apos;t get location working?
          </summary>
          <div className="grid gap-2 pb-2">
            <p className="text-sm leading-5">
              You have {graceRemaining} unverified{" "}
              {graceRemaining === 1 ? "stamp" : "stamps"} left. Adding one uses
              this allowance. Trying location again doesn&apos;t.
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={disabled || acquiring}
              onClick={onUseGrace}
            >
              Add without location
            </Button>
          </div>
        </details>
      ) : null}
      {hint ? (
        <p
          className="text-xs leading-5 text-muted-foreground"
          aria-live="polite"
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
