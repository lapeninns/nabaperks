"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  resolveStampLocation,
  type StampLocationCapture,
} from "@/lib/customer/stamp-location-capture"

export type LocationRetryButtonProps = {
  disabled: boolean
  onGranted: (capture: StampLocationCapture) => void
}

/**
 * Asks the browser for location on a tap. That can reopen the permission
 * sheet while the site is still on Ask. It cannot open the phone's Settings
 * app after a hard Block — the hint then tells the customer where to allow it.
 */
export function LocationRetryButton({
  disabled,
  onGranted,
}: LocationRetryButtonProps) {
  const [asking, setAsking] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  return (
    <div data-location-retry className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={disabled || asking}
        onClick={() => {
          void askForLocation()
        }}
      >
        {asking ? "Checking location" : "Allow location"}
      </Button>
      {hint ? (
        <p className="text-xs leading-5 text-muted-foreground" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )

  async function askForLocation() {
    if (disabled || asking) return
    setAsking(true)
    try {
      const capture = await resolveStampLocation(true)
      if (capture?.locationStatus === "granted") {
        setHint(null)
        onGranted(capture)
        return
      }
      // Only a real block is a settings problem. A slow indoor fix times out
      // after SOFT_GPS_CAPTURE_TIMEOUT_MS, and sending that customer to site
      // settings is a dead end: they find Location already on Allow.
      setHint(hintFor(capture?.locationStatus))
    } finally {
      setAsking(false)
    }
  }
}

function hintFor(locationStatus: string | undefined): string {
  switch (locationStatus) {
    case "denied":
    case "denied_remembered":
      return "This browser has blocked location for this site. Open the site settings, set Location to Allow, then tap again."
    case "unsupported":
      return "This browser cannot share location. Ask the bar for today's venue code and enter it below."
    default:
      // timeout, unavailable, or no capture at all.
      return "Could not get a location fix. Move nearer a window or door and tap again, or use today's venue code below."
  }
}
