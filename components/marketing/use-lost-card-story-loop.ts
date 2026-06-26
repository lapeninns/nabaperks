"use client"

import { useEffect, useState } from "react"

import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"

export const LOST_CARD_STAMP_TOTAL = 3
/** The card vanishes after this many stamps — before the reward unlocks. */
export const LOST_CARD_LOST_AT_STAMP = 2

export const LOST_CARD_STORY_TIMING = {
  freshHoldMs: 520,
  initialDelayMs: 380,
  stampStepMs: 720,
  almostHoldMs: 1000,
  slipMs: 900,
  lostHoldMs: 2200,
} as const

export type LostCardStoryPhase =
  | "fresh"
  | "collecting"
  | "almost"
  | "slipping"
  | "lost"

/**
 * Forward lost-card loop: blank paper card → two visits stamped → slips into a
 * pocket before visit three → empty card returns with the mystery reward still
 * sealed. Reduced motion holds the faded lost state only.
 */
export function useLostCardStoryLoop(
  stampTotal: number = LOST_CARD_STAMP_TOTAL,
  lostAtStamp: number = LOST_CARD_LOST_AT_STAMP
) {
  const shouldReduceMotion = useReducedMotionHook()
  const safeTotal = Math.max(stampTotal, 1)
  const safeLostAt = Math.min(Math.max(lostAtStamp, 1), safeTotal)
  const [phase, setPhase] = useState<LostCardStoryPhase>("fresh")
  const [earnedCount, setEarnedCount] = useState(0)
  const [slamIndex, setSlamIndex] = useState(-1)

  useEffect(() => {
    if (shouldReduceMotion) return

    let cancelled = false
    const timeouts = new Set<ReturnType<typeof setTimeout>>()

    const schedule = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        timeouts.delete(id)
        if (!cancelled) fn()
      }, delay)
      timeouts.add(id)
    }

    const beginFresh = () => {
      setPhase("fresh")
      setEarnedCount(0)
      setSlamIndex(-1)
      schedule(beginCollecting, LOST_CARD_STORY_TIMING.freshHoldMs)
    }

    const beginCollecting = () => {
      setPhase("collecting")
      setEarnedCount(0)
      setSlamIndex(-1)
      schedule(() => stepStamp(1), LOST_CARD_STORY_TIMING.initialDelayMs)
    }

    const stepStamp = (count: number) => {
      setEarnedCount(count)
      setSlamIndex(count - 1)

      if (count < safeLostAt) {
        schedule(() => stepStamp(count + 1), LOST_CARD_STORY_TIMING.stampStepMs)
        return
      }

      schedule(() => {
        setSlamIndex(-1)
        setPhase("almost")
        schedule(beginSlip, LOST_CARD_STORY_TIMING.almostHoldMs)
      }, LOST_CARD_STORY_TIMING.stampStepMs)
    }

    const beginSlip = () => {
      setPhase("slipping")
      schedule(beginLost, LOST_CARD_STORY_TIMING.slipMs)
    }

    const beginLost = () => {
      setPhase("lost")
      setEarnedCount(0)
      setSlamIndex(-1)
      schedule(beginFresh, LOST_CARD_STORY_TIMING.lostHoldMs)
    }

    beginFresh()

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [safeLostAt, safeTotal, shouldReduceMotion])

  const displayEarnedCount = shouldReduceMotion
    ? 0
    : phase === "lost"
      ? 0
      : earnedCount

  return {
    phase: shouldReduceMotion ? ("lost" as const) : phase,
    earnedCount: displayEarnedCount,
    slamIndex: shouldReduceMotion ? -1 : slamIndex,
    stampTotal: safeTotal,
    lostAtStamp: safeLostAt,
    shouldReduceMotion,
  }
}

export type LostCardStoryCopy = {
  eyebrow: string
  footer: string
  rewardNote: string
}

export function lostCardStoryCopy({
  phase,
  earnedCount,
  stampTotal,
  lostAtStamp,
}: {
  phase: LostCardStoryPhase
  earnedCount: number
  stampTotal: number
  lostAtStamp: number
}): LostCardStoryCopy {
  if (phase === "lost") {
    return {
      eyebrow: "A card you lost",
      footer: "Last seen: a coat pocket",
      rewardNote: "The mystery reward never made it to the counter.",
    }
  }

  if (phase === "almost") {
    return {
      eyebrow: "Almost there",
      footer: `${lostAtStamp} of ${stampTotal} stamps — one visit from the reward`,
      rewardNote: "One more visit to collect the mystery reward.",
    }
  }

  if (phase === "slipping") {
    return {
      eyebrow: "Almost there",
      footer: "Into a coat pocket with two stamps on it",
      rewardNote: "So close — then the card was gone.",
    }
  }

  if (earnedCount > 0) {
    return {
      eyebrow: `Visit ${earnedCount}`,
      footer: `${earnedCount} of ${stampTotal} stamps collected`,
      rewardNote: "Mystery reward stays sealed until visit three.",
    }
  }

  return {
    eyebrow: "Paper stamp card",
    footer: `${stampTotal} visits to the mystery reward`,
    rewardNote: "Mystery reward stays sealed until visit three.",
  }
}
