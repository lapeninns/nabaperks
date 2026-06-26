"use client"

import { useEffect, useState } from "react"

import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"

import { MARKETING_DEMO_OTP } from "@/components/marketing/marketing-demo"

export const SOLUTION_STAMP_TOTAL = 3
export const SOLUTION_SAVE_OTP_DIGIT_COUNT = MARKETING_DEMO_OTP.length

export const SOLUTION_STORY_TIMING = {
  scanHoldMs: 1080,
  saveOtpStartDelayMs: 320,
  saveOtpDigitMs: 145,
  /** Covers the OTP reveal plus a short read beat after the last digit. */
  saveHoldMs: 1460,
  initialStampDelayMs: 480,
  stampStepMs: 820,
  giftHoldMs: 1400,
  collectHoldMs: 2600,
} as const

export type SolutionStoryPhase =
  | "scan"
  | "save"
  | "stamping"
  | "gift"
  | "collect"

export type SolutionCardPanel = "stamps" | "gift"

export type SolutionStoryStep = "scan" | "save" | "stamp" | "collect"

const SOLUTION_STORY_STEP_INDEX: Record<SolutionStoryStep, number> = {
  scan: 0,
  save: 1,
  stamp: 2,
  collect: 3,
}

export function solutionStoryStepIndex(step: SolutionStoryStep): number {
  return SOLUTION_STORY_STEP_INDEX[step]
}

export function solutionCardPanel(phase: SolutionStoryPhase): SolutionCardPanel {
  return phase === "gift" || phase === "collect" ? "gift" : "stamps"
}

/** Maps the solution story onto the four how-it-works step cards. */
export function solutionPhaseToStepIndex(phase: SolutionStoryPhase): number {
  if (phase === "scan") return 0
  if (phase === "save") return 1
  if (phase === "stamping") return 2
  return 3
}

export type PhoneStoryScreen = "scan" | "save" | "card" | "reward"

export function solutionPhaseToPhoneScreen(
  phase: SolutionStoryPhase
): PhoneStoryScreen {
  if (phase === "scan") return "scan"
  if (phase === "save") return "save"
  if (phase === "stamping") return "card"
  return "reward"
}

/**
 * Forward solution loop: scan → save → stamps → gift → collect → reset.
 */
export function useSolutionStoryLoop(
  stampTotal: number = SOLUTION_STAMP_TOTAL
) {
  const shouldReduceMotion = useReducedMotionHook()
  const safeTotal = Math.max(stampTotal, 1)
  const [phase, setPhase] = useState<SolutionStoryPhase>("scan")
  const [earnedCount, setEarnedCount] = useState(0)
  const [slamIndex, setSlamIndex] = useState(-1)
  const [revealSlam, setRevealSlam] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)

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

    const beginScan = () => {
      setPhase("scan")
      setCardOpen(false)
      setEarnedCount(0)
      setSlamIndex(-1)
      setRevealSlam(false)
      schedule(beginSave, SOLUTION_STORY_TIMING.scanHoldMs)
    }

    const beginSave = () => {
      setPhase("save")
      setCardOpen(true)
      schedule(beginStamping, SOLUTION_STORY_TIMING.saveHoldMs)
    }

    const beginStamping = () => {
      setPhase("stamping")
      setEarnedCount(0)
      setSlamIndex(-1)
      schedule(() => stepStamp(1), SOLUTION_STORY_TIMING.initialStampDelayMs)
    }

    const stepStamp = (count: number) => {
      setEarnedCount(count)
      setSlamIndex(count - 1)

      if (count < safeTotal) {
        schedule(() => stepStamp(count + 1), SOLUTION_STORY_TIMING.stampStepMs)
        return
      }

      schedule(() => {
        setSlamIndex(-1)
        setPhase("gift")
        setRevealSlam(true)
        schedule(beginCollect, SOLUTION_STORY_TIMING.giftHoldMs)
      }, SOLUTION_STORY_TIMING.stampStepMs)
    }

    const beginCollect = () => {
      setPhase("collect")
      setRevealSlam(false)
      schedule(beginScan, SOLUTION_STORY_TIMING.collectHoldMs)
    }

    beginScan()

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [safeTotal, shouldReduceMotion])

  const restingPhase = shouldReduceMotion ? ("collect" as const) : phase

  return {
    phase: restingPhase,
    panel: solutionCardPanel(restingPhase),
    earnedCount: shouldReduceMotion ? safeTotal : earnedCount,
    slamIndex: shouldReduceMotion ? -1 : slamIndex,
    revealSlam: shouldReduceMotion ? false : revealSlam,
    cardOpen: shouldReduceMotion ? true : cardOpen,
    stampTotal: safeTotal,
  }
}

export type SolutionStoryCopy = {
  rewardNote: string
  activeStep: SolutionStoryStep
}

export function solutionStoryCopy({
  phase,
  earnedCount,
  stampTotal,
}: {
  phase: SolutionStoryPhase
  earnedCount: number
  stampTotal: number
}): SolutionStoryCopy {
  if (phase === "scan") {
    return {
      activeStep: "scan",
      rewardNote: "The browser card opens from one scan.",
    }
  }

  if (phase === "save") {
    return {
      activeStep: "save",
      rewardNote: "One text saves the card. No app store.",
    }
  }

  if (phase === "collect") {
    return {
      activeStep: "collect",
      rewardNote: "Show the mystery reward at the counter to collect.",
    }
  }

  if (phase === "gift") {
    return {
      activeStep: "collect",
      rewardNote: "Mystery reward unlocked — ready at the counter.",
    }
  }

  if (earnedCount > 0) {
    return {
      activeStep: "stamp",
      rewardNote: `${earnedCount} of ${stampTotal} stamps — mystery reward stays sealed.`,
    }
  }

  return {
    activeStep: "stamp",
    rewardNote: `${stampTotal} visits to unlock the mystery reward.`,
  }
}
