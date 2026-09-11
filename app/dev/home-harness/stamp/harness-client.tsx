"use client"

import { useCallback, useState } from "react"
import Link from "next/link"

import { StampCollector } from "@/components/customer/stamp-collector"
import { Button } from "@/components/ui/button"
import type { SelfStampActionState } from "@/lib/customer/self-stamp-action-state"

import type { HarnessMode } from "./modes"

const LOCATION_MODES = new Set<HarnessMode>([
  "location-blocked",
  "code-rejected",
  "code-locked",
])

/**
 * The verified-visit lanes. Every one is visit four at a venue with the
 * check on; they differ in what the page payload says about the unverified
 * grace and in how the server answers a stamp request.
 */
const VERIFY_MODES: Partial<
  Record<
    HarnessMode,
    {
      unverifiedGraceRemaining: number
      stamp: SelfStampActionState
    }
  >
> = {
  // Both courtesy stamps used. A capture without a fix must not be sent at
  // all; if the collector sends one anyway the server would refuse it.
  "verify-grace-spent": {
    unverifiedGraceRemaining: 0,
    stamp: {
      status: "error",
      reason: "location_required",
      message:
        "Turn on location for this venue and scan again, or ask a team member for today's code.",
    },
  },
  // One courtesy stamp left: a capture without a fix is sent once and lands
  // unverified.
  "verify-grace-left": {
    unverifiedGraceRemaining: 1,
    stamp: {
      status: "issued",
      newStampCount: 4,
      rewardUnlocked: false,
      geoFlagged: true,
      bonusStampsApplied: 0,
      verification: "unverified",
    },
  },
  // The browser gave a fix (the spec grants geolocation) and it verified.
  "verify-located": {
    unverifiedGraceRemaining: 0,
    stamp: {
      status: "issued",
      newStampCount: 4,
      rewardUnlocked: false,
      geoFlagged: false,
      bonusStampsApplied: 0,
    },
  },
  // The code path is locked out / throttled. Grace is left on purpose: if a
  // stamp press ever rendered here, one tap would commit a courtesy stamp
  // with no location attempt, and the submit counter would show it.
  "verify-code-locked": {
    unverifiedGraceRemaining: 1,
    stamp: {
      status: "issued",
      newStampCount: 4,
      rewardUnlocked: false,
      geoFlagged: true,
      bonusStampsApplied: 0,
      verification: "unverified",
    },
  },
  "verify-code-throttled": {
    unverifiedGraceRemaining: 1,
    stamp: {
      status: "issued",
      newStampCount: 4,
      rewardUnlocked: false,
      geoFlagged: true,
      bonusStampsApplied: 0,
      verification: "unverified",
    },
  },
  // The stamp path is throttled; the code must stay on screen.
  "verify-rate-limited": {
    unverifiedGraceRemaining: 1,
    stamp: {
      status: "error",
      reason: "rate_limited",
      message:
        "You're going a little fast. Wait a few minutes, then try again.",
    },
  },
}

const LOCATION_REFUSED: SelfStampActionState = {
  status: "error",
  reason: "location_out_of_range",
  message:
    "Location couldn't confirm you're at the venue. Try again, or ask a team member for today's code.",
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

export function StampHarnessClient({
  mode,
  delayMs,
}: {
  mode: HarnessMode
  delayMs: number
}) {
  const verify = VERIFY_MODES[mode]
  const startingCurrent =
    mode === "final"
      ? 4
      : mode === "reloaded-final"
        ? 5
        : mode === "unknown-issued-bonus"
          ? 2
          : 3
  const [current, setCurrent] = useState(startingCurrent)
  const [stampDates, setStampDates] = useState(
    ["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul"].slice(0, startingCurrent)
  )
  const [canStamp, setCanStamp] = useState(
    mode !== "closed" && mode !== "reloaded-final"
  )
  const [rewardReady, setRewardReady] = useState(mode === "reloaded-final")
  const [submitCount, setSubmitCount] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastLocationStatus, setLastLocationStatus] = useState("")

  const submitStamp = useCallback(
    async (
      _state: SelfStampActionState,
      formData: FormData
    ): Promise<SelfStampActionState> => {
      setSubmitCount((count) => count + 1)
      setLastLocationStatus(String(formData.get("location_status") ?? ""))
      await wait(delayMs)

      if (verify) return verify.stamp
      if (mode === "blocked") {
        return {
          status: "error",
          message: "Today's stamp is not available yet. Try again tomorrow.",
        }
      }
      if (LOCATION_MODES.has(mode)) return LOCATION_REFUSED
      if (
        mode === "unknown" ||
        mode === "unknown-issued" ||
        mode === "unknown-issued-bonus" ||
        mode === "unknown-closed"
      ) {
        throw new Error("Harness transport failure")
      }

      return {
        status: "issued",
        newStampCount: mode === "final" ? 5 : 4,
        rewardUnlocked: mode === "final",
        geoFlagged: false,
        bonusStampsApplied: 0,
      }
    },
    [delayMs, mode, verify]
  )

  // The venue-code fallback: a wrong code counts down tries, a lockout hides
  // the input, and the right code prints the stamp through the same path.
  const submitVenueCode =
    useCallback(async (): Promise<SelfStampActionState> => {
      setSubmitCount((count) => count + 1)
      await wait(delayMs)

      if (mode === "verify-code-throttled") {
        return {
          status: "error",
          reason: "venue_code_rate_limited",
          message:
            "Too many code tries in a row. Wait a few minutes, then try again.",
        }
      }
      if (mode === "code-rejected") {
        return {
          status: "error",
          reason: "venue_code_rejected",
          attemptsRemaining: 3,
          message: "That code isn't right. Check it with a team member.",
        }
      }
      if (mode === "code-locked" || mode === "verify-code-locked") {
        return {
          status: "error",
          reason: "venue_code_locked",
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          message:
            "Too many tries. Ask a team member and try again in 15 minutes.",
        }
      }

      return {
        status: "issued",
        newStampCount: 4,
        rewardUnlocked: false,
        geoFlagged: false,
        bonusStampsApplied: 0,
        verification: "venue_code",
      }
    }, [delayMs, mode])

  const refreshCard = useCallback(() => {
    setRefreshCount((count) => count + 1)
    if (mode === "final") {
      setCurrent(5)
      setStampDates(["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul"])
      setCanStamp(false)
      setRewardReady(true)
    }
    if (mode === "unknown-issued") {
      setCurrent(4)
      setStampDates(["12 Jul", "13 Jul", "14 Jul", "16 Jul"])
      setCanStamp(false)
    }
    if (mode === "unknown-issued-bonus") {
      setCurrent(5)
      setStampDates(["12 Jul", "13 Jul", "16 Jul", "Bonus", "Bonus"])
      setCanStamp(false)
      setRewardReady(true)
    }
    if (mode === "unknown-closed") {
      setCanStamp(false)
    }
  }, [mode])

  return (
    <section className="mx-auto grid w-full max-w-customer gap-5 px-4 py-8">
      <div className="sr-only" aria-hidden="true">
        <span data-submit-count>{submitCount}</span>
        <span data-refresh-count>{refreshCount}</span>
        <span data-last-location-status>{lastLocationStatus}</span>
      </div>
      <StampCollector
        membershipId="mem_harness_stamp"
        qrId="old-crown"
        canStamp={canStamp}
        venueName="Old Crown Girton"
        cardName="Mystery Visit Card"
        current={current}
        total={5}
        stampDates={stampDates}
        todayLabel="16 Jul"
        rewardName="Mystery reward"
        rewardUnlocked={rewardReady}
        location={
          verify
            ? {
                requireGeofence: true,
                geofenceRadiusMeters: 75,
                firstVerifiedVisit: 3,
                nextVisitNumber: 4,
                unverifiedGraceRemaining: verify.unverifiedGraceRemaining,
              }
            : { requireGeofence: false, geofenceRadiusMeters: 75 }
        }
        submitStamp={submitStamp}
        submitVenueCode={submitVenueCode}
        refreshCard={refreshCard}
      />
      {rewardReady ? (
        <Button asChild size="lg" variant="reward" className="w-full">
          <Link href="/dev/home-harness/rewards">See your reward</Link>
        </Button>
      ) : (
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href="/dev/home-harness/home">Back to card</Link>
        </Button>
      )}
    </section>
  )
}
