import type { CSSProperties } from "react"

import { WetInkPop } from "@/components/motion"
import { cn } from "@/lib/utils"

import { RewardSeal, type RewardSealState } from "./reward-seal"
import { StampDot } from "./stamp-dot"

export type RewardSlotState = "locked" | "ready" | "revealed"
export { StampDot }

/** Resting tilts cycled by slot index so a row reads hand-stamped, not machine
 * perfect. Seeded by index (not random) to stay stable across SSR/renders. */
const STAMP_TILTS = ["-7deg", "-5deg", "-8deg", "-6deg"] as const

/** Maps a stamp-row slot status onto the shared reward-seal vocabulary. */
function slotSealState(slot: RewardSlotState): RewardSealState {
  if (slot === "ready") return "ready"
  if (slot === "revealed") return "waiting"
  return "sealed"
}

/**
 * The reward destination at the end of the stamp row — the prize ticket
 * miniaturised to a single chip, so the row's last slot is the *same* object
 * as the hero ticket and the celebration seal, just smaller. Sealed slots wear
 * the sun "?" mystery; ready slots turn leaf. Replaces the old gift box.
 */
export function RewardChip({
  slotState = "locked",
  label = "Mystery reward",
  slammed = false,
  placeholder = false,
  compact = false,
  className,
}: {
  slotState?: RewardSlotState
  label?: string
  /** Fire the print-pop keyframe when the slot reveals on a full card. */
  slammed?: boolean
  /** Idle-wiggle the sealed mystery on the join journey preview. */
  placeholder?: boolean
  /** Shrink the chip (~36px) for dense, non-interactive preview rows. */
  compact?: boolean
  className?: string
}) {
  const sealState = slotSealState(slotState)
  const ready = slotState === "ready"

  return (
    <span className={cn("grid justify-items-center gap-1", className)}>
      <WetInkPop active={slammed} className="block w-full">
        <span
          data-reward-slot={slotState}
          data-slammed={slammed ? true : undefined}
          className={cn(
            "grid aspect-square w-full -rotate-6 place-items-center rounded-md border-2 shadow-xs",
            compact ? "min-h-9" : "min-h-11",
            ready
              ? "border-ink bg-reward/15"
              : "border-dashed border-ink/40 bg-seal/15"
          )}
        >
          <RewardSeal
            state={sealState}
            size="sm"
            label={`${label}, ${ready ? "ready for merchant scan" : "sealed"}`}
            wiggle={placeholder && slotState === "locked"}
          />
        </span>
      </WetInkPop>
      <span className="font-mono text-[0.55rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
        {ready ? "Ready" : "Reward"}
      </span>
    </span>
  )
}

type StampGridSlot =
  | { kind: "stamp"; index: number }
  | { kind: "reward"; slotState: RewardSlotState }

type StampGridLayout = "row" | "wrap"

export function StampGrid({
  current,
  total,
  dates,
  slamIndex = -1,
  showEmptySlotNumbers = false,
  rewardSlot,
  previewJourney = false,
  compact = false,
  layout = "row",
  wrapColumns = 3,
  venueName,
  venueInitials,
  className,
}: {
  current: number
  total: number
  dates?: string[]
  slamIndex?: number
  showEmptySlotNumbers?: boolean
  /** Reward-ticket chip destination after the stamp slots. */
  rewardSlot?: RewardSlotState
  /** Illustrate nearly-complete progress on join previews (total − 1 earned). */
  previewJourney?: boolean
  /** Shrink slots (~36px) and tighten gaps for dense preview rows. */
  compact?: boolean
  /** Single row (default) or wrapped rows for narrow surfaces. */
  layout?: StampGridLayout
  /** Max slots per row when layout is wrap (stamps + reward chip). */
  wrapColumns?: number
  venueName?: string
  venueInitials?: string
  className?: string
}) {
  const safeTotal = Math.max(total, 0)
  const safeCurrent = previewJourney
    ? Math.min(Math.max(safeTotal - 1, 0), safeTotal)
    : Math.min(Math.max(current, 0), safeTotal)
  const listLabel = `${safeCurrent} of ${safeTotal} stamps earned${rewardSlot ? ", mystery reward at the end" : ""}`

  const slots = buildStampGridSlots(safeTotal, rewardSlot)
  const gapClass = compact ? "gap-1.5" : "gap-2"

  function renderSlot(slot: StampGridSlot, key: string) {
    if (slot.kind === "reward") {
      return (
        <span key={key} role="listitem">
          <RewardChip slotState={slot.slotState} compact={compact} />
        </span>
      )
    }

    const earned = slot.index < safeCurrent

    return (
      <span
        key={key}
        role="listitem"
        style={
          earned
            ? ({
                "--stamp-rot": STAMP_TILTS[slot.index % STAMP_TILTS.length],
              } as CSSProperties)
            : undefined
        }
      >
        <StampDot
          earned={earned}
          label={`Stamp ${slot.index + 1} ${earned ? "earned" : "empty"}`}
          date={earned ? dates?.[slot.index] : undefined}
          slotNumber={slot.index + 1}
          showEmptySlotNumber={showEmptySlotNumbers}
          slammed={slot.index === slamIndex}
          compact={compact}
          venueName={venueName}
          venueInitials={venueInitials}
        />
      </span>
    )
  }

  if (layout === "wrap") {
    const columns = Math.max(wrapColumns, 1)

    return (
      <div
        role="list"
        aria-label={listLabel}
        className={cn("grid w-full", gapClass, className)}
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {slots.map((slot, index) => renderSlot(slot, String(index)))}
      </div>
    )
  }

  const columnCount = Math.min(Math.max(safeTotal, 1), 6) + (rewardSlot ? 1 : 0)

  return (
    <div
      role="list"
      aria-label={listLabel}
      className={cn("grid", gapClass, className)}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {slots.map((slot, index) => renderSlot(slot, String(index)))}
    </div>
  )
}

function buildStampGridSlots(
  total: number,
  rewardSlot?: RewardSlotState
): StampGridSlot[] {
  const slots: StampGridSlot[] = Array.from({ length: total }, (_, index) => ({
    kind: "stamp",
    index,
  }))

  if (rewardSlot) {
    slots.push({ kind: "reward", slotState: rewardSlot })
  }

  return slots
}
