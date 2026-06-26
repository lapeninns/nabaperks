"use client"

import { useEffect, useState } from "react"

import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"

export const STAMP_JOURNEY_TIMING = {
  initialDelayMs: 520,
  stampStepMs: 780,
  revealMs: 420,
  loopPauseMs: 2600,
} as const

/**
 * Decorative stamp-row loop: empty → stamps slam in one by one → reveal beat →
 * pause → reset. Reduced motion shows the finished row without animating.
 */
export function useStampJourneyLoop(total: number) {
  const shouldReduceMotion = useReducedMotionHook()
  const safeTotal = Math.max(total, 0)
  const [earnedCount, setEarnedCount] = useState(0)
  const [slamIndex, setSlamIndex] = useState(-1)
  const [revealed, setRevealed] = useState(false)
  const [revealSlam, setRevealSlam] = useState(false)
  const [revealKey, setRevealKey] = useState(0)
  const [cycleIndex, setCycleIndex] = useState(0)

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

    const resetCycle = (advanceReward = false) => {
      setEarnedCount(0)
      setRevealed(false)
      setRevealSlam(false)
      setSlamIndex(-1)
      if (advanceReward) {
        setCycleIndex((index) => index + 1)
      }
      schedule(() => stepStamp(1), STAMP_JOURNEY_TIMING.initialDelayMs)
    }

    const stepStamp = (count: number) => {
      setEarnedCount(count)
      setSlamIndex(count - 1)
      setRevealed(false)
      setRevealSlam(false)

      if (count < safeTotal) {
        schedule(() => stepStamp(count + 1), STAMP_JOURNEY_TIMING.stampStepMs)
        return
      }

      schedule(() => {
        setSlamIndex(-1)
        setRevealed(true)
        setRevealSlam(true)
        setRevealKey((key) => key + 1)
        schedule(() => resetCycle(true), STAMP_JOURNEY_TIMING.loopPauseMs)
      }, STAMP_JOURNEY_TIMING.revealMs)
    }

    resetCycle(false)

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [safeTotal, shouldReduceMotion])

  return {
    earnedCount: shouldReduceMotion ? safeTotal : earnedCount,
    slamIndex: shouldReduceMotion ? -1 : slamIndex,
    revealed: shouldReduceMotion ? true : revealed,
    revealSlam: shouldReduceMotion ? false : revealSlam,
    revealKey,
    cycleIndex,
    shouldReduceMotion,
  }
}
