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
              : "border-dashed border-line-strong bg-seal/15"
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
      <span className="mono-id text-muted-foreground">
        {ready ? "Ready" : "Reward"}
      </span>
    </span>
  )
}

type StampGridSlot =
  | { kind: "stamp"; index: number }
  | { kind: "reward"; slotState: RewardSlotState }

type StampGridLayout = "row" | "wrap"
type StampGridFlow = "adaptive" | "horizontal"
type StampGridCountPlacement = "above" | "inline"

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
  flow = "adaptive",
  wrapColumns = 3,
  showCount = false,
  countPlacement = "above",
  venueName,
  venueInitials,
  className,
  onSlamComplete,
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
  /**
   * Adaptive (default) wraps discs via auto-fit when space is tight; horizontal
   * keeps every slot on one row at the minimum track size (members tables).
   */
  flow?: StampGridFlow
  /** Max slots per row when layout is wrap (stamps + reward chip). */
  wrapColumns?: number
  /**
   * Reserve an always-readable "current / total" mono count above the grid —
   * the progress stays legible even where discs render at their minimum size
   * (dense table cells, very narrow columns).
   */
  showCount?: boolean
  /** Place the count above the grid (default) or inline before the row. */
  countPlacement?: StampGridCountPlacement
  venueName?: string
  venueInitials?: string
  className?: string
  onSlamComplete?: () => void
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
          onSlamComplete={
            slot.index === slamIndex ? onSlamComplete : undefined
          }
        />
      </span>
    )
  }

  // Width-pressure strategy: adaptive row layout wraps via auto-fit tracks with
  // a hard minimum (44px, 36px compact), so discs keep their circle and never
  // compress into overlapping ellipses inside narrow cells. Horizontal flow pins
  // one fixed track per slot so dense readbacks stay a single row; the table's
  // overflow-x container absorbs any extra width.
  const minTrack = compact ? "2.25rem" : "2.75rem"
  const gridStyle: CSSProperties =
    flow === "horizontal"
      ? {
          gridTemplateColumns: `repeat(${Math.max(slots.length, 1)}, ${minTrack})`,
        }
      : layout === "wrap"
        ? {
            gridTemplateColumns: `repeat(${Math.max(wrapColumns, 1)}, minmax(0, 1fr))`,
          }
        : {
            gridTemplateColumns: `repeat(auto-fit, minmax(min(${minTrack}, 100%), 1fr))`,
          }

  const grid = (
    <div
      role="list"
      aria-label={listLabel}
      className={cn(
        flow === "horizontal" ? "inline-grid w-max max-w-full" : "grid",
        layout === "wrap" && flow !== "horizontal" && "w-full",
        gapClass,
        showCount ? undefined : className
      )}
      style={gridStyle}
    >
      {slots.map((slot, index) => renderSlot(slot, String(index)))}
    </div>
  )

  if (!showCount) {
    return grid
  }

  if (countPlacement === "inline") {
    return (
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
          className
        )}
      >
        <span
          aria-hidden="true"
          className="mono-id numeric-tabular shrink-0 text-muted-foreground"
        >
          {safeCurrent} / {safeTotal}
        </span>
        {grid}
      </div>
    )
  }

  return (
    <div className={cn("grid gap-1.5", className)}>
      <span
        aria-hidden="true"
        className="mono-id numeric-tabular justify-self-end text-muted-foreground"
      >
        {safeCurrent} / {safeTotal}
      </span>
      {grid}
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
