"use client"

import { useCallback, useState } from "react"
import Link from "next/link"

import { StampCollector } from "@/components/customer/stamp-collector"
import { Button } from "@/components/ui/button"
import type { SelfStampActionState } from "@/lib/customer/self-stamp-action-state"

type HarnessMode =
  | "success"
  | "final"
  | "blocked"
  | "unknown"
  | "unknown-issued"
  | "unknown-issued-bonus"
  | "unknown-closed"
  | "closed"
  | "reloaded-final"

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
    ["12 Jul", "13 Jul", "14 Jul", "15 Jul", "16 Jul"].slice(
      0,
      startingCurrent
    )
  )
  const [canStamp, setCanStamp] = useState(
    mode !== "closed" && mode !== "reloaded-final"
  )
  const [rewardReady, setRewardReady] = useState(mode === "reloaded-final")
  const [submitCount, setSubmitCount] = useState(0)
  const [refreshCount, setRefreshCount] = useState(0)

  const submitStamp = useCallback(
    async (): Promise<SelfStampActionState> => {
      setSubmitCount((count) => count + 1)
      await wait(delayMs)

      if (mode === "blocked") {
        return {
          status: "error",
          message: "Today's stamp is not available yet. Try again tomorrow.",
        }
      }
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
    [delayMs, mode]
  )

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
        location={{ requireGeofence: false, geofenceRadiusMeters: 75 }}
        submitStamp={submitStamp}
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
