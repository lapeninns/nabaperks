"use client"

import { useState } from "react"
import type { CSSProperties } from "react"

import { stampDisplayDates } from "@/lib/customer/uk-calendar"
import { cn } from "@/lib/utils"

import { RewardChip, StampDot } from "./stamp-grid"
import { useStampJourneyLoop } from "./use-stamp-journey-loop"

/** Same hand-stamped tilt cycle as the live StampGrid, seeded by slot index. */
const PREVIEW_TILTS = ["-7deg", "-5deg", "-8deg", "-6deg"] as const

/**
 * Decorative join preview: empty row → stamp 1, 2, 3 slam in → gift box pops on.
 * Loops gently on the welcome screen; reduced motion shows the finished row.
 */
export function StampJourneyPreview({
  total,
  venueName,
  compact = false,
  className,
}: {
  total: number
  venueName?: string
  compact?: boolean
  className?: string
}) {
  const safeTotal = Math.max(total, 0)
  /** Anchor to the UK calendar day when the customer opens this page. */
  const [previewDates] = useState(() => stampDisplayDates(safeTotal))
  const { earnedCount, slamIndex, revealed, revealSlam, revealKey } =
    useStampJourneyLoop(safeTotal)

  const columnCount = Math.min(Math.max(safeTotal, 1), 6) + 1

  return (
    <div
      role="list"
      aria-label={`Example loyalty journey: ${safeTotal} stamps then a mystery reward`}
      className={cn(
        "grid",
        compact
          ? "grid-cols-3 gap-1.5 min-[420px]:[grid-template-columns:repeat(var(--stamp-journey-cols),minmax(0,1fr))]"
          : "[grid-template-columns:repeat(var(--stamp-journey-cols),minmax(0,1fr))] gap-2",
        className
      )}
      style={{
        "--stamp-journey-cols": columnCount,
      } as CSSProperties}
    >
      {Array.from({ length: safeTotal }).map((_, index) => {
        const earned = index < earnedCount

        return (
          <span
            key={index}
            role="listitem"
            className={cn(
              compact && "w-16 justify-self-center min-[420px]:w-full"
            )}
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
              compact={compact}
              venueName={venueName}
            />
          </span>
        )
      })}
      <span
        role="listitem"
        className={cn(compact && "w-16 justify-self-center min-[420px]:w-full")}
      >
        {revealed ? (
          <RewardChip
            key={revealKey}
            slotState="locked"
            slammed={revealSlam}
            compact={compact}
          />
        ) : (
          <RewardChip slotState="locked" placeholder compact={compact} />
        )}
      </span>
    </div>
  )
}
