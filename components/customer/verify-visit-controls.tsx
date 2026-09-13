"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { LocationPermissionHelp } from "@/components/customer/location-permission-help"
import { NativeGeolocationButton } from "@/components/customer/native-geolocation-button"
import { Button } from "@/components/ui/button"
import {
  resolveStampLocation,
  SOFT_GPS_CAPTURE_TIMEOUT_MS,
  supportsNativeGeolocationElement,
  type StampLocationCapture,
} from "@/lib/customer/stamp-location-capture"
import type { StampLocationIssue } from "@/lib/customer/stamp-location-recovery"
import { cn } from "@/lib/utils"

export type VerifyVisitControlsProps = {
  /** A stamp request is in flight or the card is secured — neither control may start anything. */
  disabled: boolean
  recoveryIssue?: StampLocationIssue
  retry?: boolean
  graceRemaining?: number
  onUseGrace: () => void
  /** The code form is already open beneath, so its button is redundant. */
  codeOpen: boolean
  /**
   * The six-digit form itself, rendered inside the recovery area rather than
   * after it. A blocked permission is exactly when a customer needs the field
   * in front of them: leaving it below the grace and settings disclosures put
   * the one thing that still works at the bottom of the screen.
   */
  venueCodeSlot?: ReactNode
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
 * reading on the tap. After a Chrome deny, the native location control can
 * reopen a blocked prompt. "Enter venue code" opens the six-digit form
 * without a failed location attempt first. Once permission is refused the
 * order flips: the venue code sits before the retry control and the
 * site-settings steps fold into "Help with location access" beneath, so the
 * route that works at the counter is never below a screen of instructions.
 */
export function VerifyVisitControls({
  disabled,
  recoveryIssue,
  retry,
  graceRemaining,
  onUseGrace,
  codeOpen,
  venueCodeSlot,
  onCapture,
  onOpenCode,
  onAcquiringChange,
}: VerifyVisitControlsProps) {
  const [acquiring, setAcquiring] = useState(false)
  const [slow, setSlow] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const slowTimerRef = useRef<number | null>(null)
  const nativeRecovery =
    recoveryIssue === "denied" && supportsNativeGeolocationElement()

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current)
      }
    }
  }, [])

  function beginWait() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAcquiring(true)
    setSlow(false)
    onAcquiringChange(true)
    if (slowTimerRef.current !== null) {
      window.clearTimeout(slowTimerRef.current)
    }
    slowTimerRef.current = window.setTimeout(
      () => setSlow(true),
      SOFT_GPS_CAPTURE_TIMEOUT_MS
    )
    return controller
  }

  function endWait(controller: AbortController) {
    if (slowTimerRef.current !== null) {
      window.clearTimeout(slowTimerRef.current)
      slowTimerRef.current = null
    }
    if (abortRef.current === controller) {
      abortRef.current = null
      setAcquiring(false)
      setSlow(false)
      onAcquiringChange(false)
    }
  }

  async function askForLocation() {
    if (disabled || abortRef.current) return
    const controller = beginWait()

    try {
      const capture = await resolveStampLocation(true, controller.signal)
      if (capture && !controller.signal.aborted) onCapture(capture)
    } finally {
      endWait(controller)
    }
  }

  function handleNativeBusy(busy: boolean) {
    if (busy) {
      if (disabled || abortRef.current) return
      beginWait()
      return
    }
    const controller = abortRef.current
    if (controller) endWait(controller)
  }

  function handleNativeCapture(capture: StampLocationCapture) {
    const controller = abortRef.current
    if (!controller || controller.signal.aborted) return
    endWait(controller)
    onCapture(capture)
  }

  function openCode() {
    abortRef.current?.abort()
    onOpenCode()
  }

  const hint =
    acquiring && slow
      ? "Taking longer than expected. Keep waiting, or enter today's venue code."
      : null

  // A refused permission is the one issue a retry rarely fixes on the spot:
  // the browser stops prompting, and the settings route ends in a different
  // app. So the code a team member reads out becomes the primary recovery and
  // the location attempt stays as a real, honest second chance. Every other
  // issue (a slow, missing or coarse fix) can be answered by trying again,
  // and keeps its own instruction and primary retry.
  const deniedRecovery = recoveryIssue === "denied"
  const venueCodeButton = codeOpen ? null : (
    <Button
      type="button"
      variant={deniedRecovery ? "default" : "outline"}
      size="lg"
      className="w-full"
      disabled={disabled}
      onClick={openCode}
      data-enter-venue-code
    >
      Enter venue code
    </Button>
  )

  return (
    <div data-verify-visit className="grid gap-2">
      {deniedRecovery ? (
        <div className="grid gap-2" data-venue-code-route>
          <p className="text-sm leading-5">
            Ask a team member for today&apos;s venue code.
          </p>
          {venueCodeButton}
          {venueCodeSlot}
        </div>
      ) : null}
      {nativeRecovery ? (
        <NativeGeolocationButton
          disabled={disabled || acquiring}
          onCapture={handleNativeCapture}
          onBusyChange={handleNativeBusy}
        />
      ) : (
        <Button
          type="button"
          variant={deniedRecovery ? "outline" : "default"}
          size="lg"
          className={cn("w-full", !deniedRecovery && "hover:bg-primary")}
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
      )}
      {recoveryIssue && !deniedRecovery ? (
        <p className="text-sm leading-5 text-muted-foreground">
          No stamp added. You can also ask a team member for today&apos;s venue
          code.
        </p>
      ) : null}
      {deniedRecovery ? null : venueCodeButton}
      {deniedRecovery ? null : venueCodeSlot}
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
      {deniedRecovery ? (
        <LocationPermissionHelp nativeRecovery={nativeRecovery} />
      ) : null}
    </div>
  )
}
