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
export function useStampJourneyLoop(
  total: number,
  { paused = false }: { paused?: boolean } = {}
) {
  const shouldReduceMotion = useReducedMotionHook()
  const safeTotal = Math.max(total, 0)
  // Start in the completed state so SSR / no-JS / reduced-motion first paint
  // shows the finished product card. The loop resets and replays only when
  // motion is allowed, entering from this natural rest frame (no CLS, no
  // hydration mismatch — the first client render matches the server).
  const [earnedCount, setEarnedCount] = useState(safeTotal)
  const [slamIndex, setSlamIndex] = useState(-1)
  const [revealed, setRevealed] = useState(true)
  const [revealSlam, setRevealSlam] = useState(false)
  const [revealKey, setRevealKey] = useState(0)
  const [cycleIndex, setCycleIndex] = useState(0)

  useEffect(() => {
    if (shouldReduceMotion) return

    // A paused loop schedules NOTHING. The hero card used to pause by masking
    // the hook's output with the finished frame while the timer chain ran on
    // underneath — so "Pause" stopped the picture but not the work, and
    // `cycleIndex` kept advancing behind the mask, meaning the reward had
    // silently moved on by the time anyone pressed Play (01#17).
    if (paused) return

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

    // Hold the SSR-rendered completed state for one pause beat, then reset and
    // replay the loop, so motion users transition seamlessly from first paint.
    schedule(() => resetCycle(true), STAMP_JOURNEY_TIMING.loopPauseMs)

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [safeTotal, shouldReduceMotion, paused])

  // Paused reports the same finished rest frame that SSR and reduced motion
  // render, so a pause can never leave a half-stamped card on screen.
  const atRest = shouldReduceMotion || paused

  return {
    earnedCount: atRest ? safeTotal : earnedCount,
    slamIndex: atRest ? -1 : slamIndex,
    revealed: atRest ? true : revealed,
    revealSlam: atRest ? false : revealSlam,
    revealKey,
    cycleIndex,
    shouldReduceMotion,
  }
}
