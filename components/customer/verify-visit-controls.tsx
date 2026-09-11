"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  geolocationPermissionState,
  resolveStampLocation,
  type GeolocationPermissionState,
  type StampLocationCapture,
} from "@/lib/customer/stamp-location-capture"

/** After this long without an answer the hint says so; the wait itself goes on. */
const SLOW_FIX_HINT_MS = 10_000

export type VerifyVisitControlsProps = {
  /** A stamp request is in flight or the card is secured — neither control may start anything. */
  disabled: boolean
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
  codeOpen,
  onCapture,
  onOpenCode,
  onAcquiringChange,
}: VerifyVisitControlsProps) {
  const [acquiring, setAcquiring] = useState(false)
  const [slow, setSlow] = useState(false)
  const [permission, setPermission] =
    useState<GeolocationPermissionState>("unknown")
  const abortRef = useRef<AbortController | null>(null)

  // Copy only: a blocked site cannot be re-prompted by script, so the hint
  // names where to allow it. A missing or throwing Permissions API resolves
  // to "unknown" and hides nothing.
  useEffect(() => {
    let live = true
    void geolocationPermissionState().then((state) => {
      if (live) setPermission(state)
    })
    return () => {
      live = false
    }
  }, [acquiring])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function askForLocation() {
    if (disabled || acquiring) return
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
      if (abortRef.current === controller) abortRef.current = null
      setAcquiring(false)
      setSlow(false)
      onAcquiringChange(false)
    }
  }

  function openCode() {
    abortRef.current?.abort()
    onOpenCode()
  }

  const hint =
    acquiring && slow
      ? "Taking longer than expected. Keep waiting, or enter today's venue code."
      : !acquiring && permission === "denied"
        ? "Location is blocked for this site. Allow it in your browser settings, then tap again."
        : null

  return (
    <div data-verify-visit className="grid gap-2">
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={disabled || acquiring}
        onClick={() => {
          void askForLocation()
        }}
        data-use-location
      >
        {acquiring ? "Checking location" : "Use my location"}
      </Button>
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
