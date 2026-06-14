"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"

import type { CSSProperties } from "react"

import { stampDisplayDates } from "@/lib/customer/uk-calendar"
import { cn } from "@/lib/utils"

import { RewardChip, StampDot } from "./stamp-grid"

/** Same hand-stamped tilt cycle as the live StampGrid, seeded by slot index. */
const PREVIEW_TILTS = ["-7deg", "-5deg", "-8deg", "-6deg"] as const

const INITIAL_DELAY_MS = 520
const STAMP_STEP_MS = 780
const GIFT_REVEAL_MS = 420
const LOOP_PAUSE_MS = 2600

/**
 * Decorative join preview: empty row → stamp 1, 2, 3 slam in → gift box pops on.
 * Loops gently on the welcome screen; reduced motion shows the finished row.
 */
export function StampJourneyPreview({
  total,
  venueName,
  className,
}: {
  total: number
  venueName?: string
  className?: string
}) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const safeTotal = Math.max(total, 0)
  /** Anchor to the UK calendar day when the customer opens this page. */
  const [previewDates] = useState(() => stampDisplayDates(safeTotal))
  const [earnedCount, setEarnedCount] = useState(0)
  const [giftRevealed, setGiftRevealed] = useState(false)
  const [slamIndex, setSlamIndex] = useState(-1)
  const [giftSlam, setGiftSlam] = useState(false)
  const [giftRevealKey, setGiftRevealKey] = useState(0)

  useEffect(() => {
    // Reduced motion never animates — the finished row is derived during render.
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

    const resetCycle = () => {
      setEarnedCount(0)
      setGiftRevealed(false)
      setGiftSlam(false)
      setSlamIndex(-1)
      schedule(() => stepStamp(1), INITIAL_DELAY_MS)
    }

    const stepStamp = (count: number) => {
      setEarnedCount(count)
      setSlamIndex(count - 1)
      setGiftRevealed(false)
      setGiftSlam(false)

      if (count < safeTotal) {
        schedule(() => stepStamp(count + 1), STAMP_STEP_MS)
        return
      }

      schedule(() => {
        setSlamIndex(-1)
        setGiftRevealed(true)
        setGiftSlam(true)
        setGiftRevealKey((key) => key + 1)
        schedule(resetCycle, LOOP_PAUSE_MS)
      }, GIFT_REVEAL_MS)
    }

    resetCycle()

    return () => {
      cancelled = true
      for (const id of timeouts) clearTimeout(id)
    }
  }, [safeTotal, shouldReduceMotion])

  // Reduced motion shows the completed row without ever animating state.
  const renderEarnedCount = shouldReduceMotion ? safeTotal : earnedCount
  const renderGiftRevealed = shouldReduceMotion ? true : giftRevealed

  const columnCount = Math.min(Math.max(safeTotal, 1), 6) + 1

  return (
    <div
      role="list"
      aria-label={`Example loyalty journey: ${safeTotal} stamps then a mystery reward`}
      className={cn("grid gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: safeTotal }).map((_, index) => {
        const earned = index < renderEarnedCount

        return (
          <span
            key={index}
            role="listitem"
            style={
              earned
                ? ({
                    "--stamp-rot": PREVIEW_TILTS[index % PREVIEW_TILTS.length],
                  } as CSSProperties)
                : undefined
            }
          >
            <StampDot
              earned={earned}
              label={`Stamp ${index + 1} ${earned ? "earned" : "empty"}`}
              date={earned ? previewDates[index] : undefined}
              slotNumber={index + 1}
              showEmptySlotNumber={!earned}
              slammed={index === slamIndex}
              venueName={venueName}
            />
          </span>
        )
      })}
      <span role="listitem">
        {renderGiftRevealed ? (
          <RewardChip key={giftRevealKey} slotState="locked" slammed={giftSlam} />
        ) : (
          <RewardChip slotState="locked" placeholder />
        )}
      </span>
    </div>
  )
}
