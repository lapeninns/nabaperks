import { cn } from "@/lib/utils"

import { RewardSeal, type RewardSealState } from "./reward-seal"

export type RewardSlotState = "locked" | "ready" | "revealed"

export function StampDot({
  earned,
  label,
  date,
  slotNumber,
  showEmptySlotNumber = false,
  slammed = false,
  compact = false,
  className,
}: {
  earned: boolean
  label: string
  date?: string
  slotNumber?: number
  /** Show 1, 2, 3… inside empty slots — used on join previews before progress exists. */
  showEmptySlotNumber?: boolean
  /** Fire the print-slam keyframe on a freshly-earned stamp. */
  slammed?: boolean
  /** Shrink the slot (~36px) for dense, non-interactive preview rows. */
  compact?: boolean
  className?: string
}) {
  const emptyLabel =
    showEmptySlotNumber && slotNumber !== undefined ? String(slotNumber) : ""

  return (
    <span className="grid justify-items-center gap-1">
      <span
        role="img"
        aria-label={date && earned ? `${label}, ${date}` : label}
        data-earned={earned}
        data-slammed={earned && slammed ? true : undefined}
        style={
          earned && slammed
            ? { animation: "w-slam var(--w-dur-slam) var(--w-ease-slam) both" }
            : undefined
        }
        className={cn(
          "relative grid aspect-square w-full place-items-center overflow-hidden rounded-full border-2 transition-[background-color,border-color,transform] duration-[var(--duration-reveal)] ease-[var(--ease-stamp)] motion-reduce:transition-none",
          compact ? "min-h-9" : "min-h-11",
          earned
            ? "-rotate-6 border-ink bg-stamp text-stamp-foreground shadow-xs"
            : "border-dashed border-border bg-background text-muted-foreground",
          className
        )}
      >
        {earned ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[5px] rounded-full border border-dashed border-stamp-foreground/90"
            />
            <span className="absolute inset-[9px] flex flex-col items-center justify-between py-0.5">
              <span className="flex flex-1 items-center justify-center">
                <span
                  aria-hidden="true"
                  className="text-[1.25rem] leading-none font-extrabold"
                >
                  ✱
                </span>
              </span>
              {date ? (
                <span className="shrink-0 text-[0.46rem] leading-none font-extrabold tracking-[0.05em] uppercase">
                  {date}
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <span
            aria-hidden="true"
            className="text-base leading-none font-extrabold tabular-nums"
          >
            {emptyLabel}
          </span>
        )}
      </span>
    </span>
  )
}

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
      <span
        data-reward-slot={slotState}
        data-slammed={slammed ? true : undefined}
        style={
          slammed
            ? { animation: "w-pop 420ms var(--w-ease-slam) both" }
            : undefined
        }
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
          label={`${label}, ${ready ? "ready to redeem" : "sealed"}`}
          wiggle={placeholder && slotState === "locked"}
        />
      </span>
      <span className="font-mono text-[0.55rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
        {ready ? "Ready" : "Reward"}
      </span>
    </span>
  )
}

export function StampGrid({
  current,
  total,
  dates,
  slamIndex = -1,
  showEmptySlotNumbers = false,
  rewardSlot,
  previewJourney = false,
  compact = false,
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
  className?: string
}) {
  const safeTotal = Math.max(total, 0)
  const safeCurrent = previewJourney
    ? Math.min(Math.max(safeTotal - 1, 0), safeTotal)
    : Math.min(Math.max(current, 0), safeTotal)
  const columnCount =
    Math.min(Math.max(safeTotal, 1), 6) + (rewardSlot ? 1 : 0)

  return (
    <div
      role="list"
      aria-label={`${safeCurrent} of ${safeTotal} stamps earned${rewardSlot ? ", mystery reward at the end" : ""}`}
      className={cn("grid", compact ? "gap-1.5" : "gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: safeTotal }).map((_, index) => {
        const earned = index < safeCurrent

        return (
          <span key={index} role="listitem">
            <StampDot
              earned={earned}
              label={`Stamp ${index + 1} ${earned ? "earned" : "empty"}`}
              date={earned ? dates?.[index] : undefined}
              slotNumber={index + 1}
              showEmptySlotNumber={showEmptySlotNumbers}
              slammed={index === slamIndex}
              compact={compact}
            />
          </span>
        )
      })}
      {rewardSlot ? (
        <span role="listitem">
          <RewardChip slotState={rewardSlot} compact={compact} />
        </span>
      ) : null}
    </div>
  )
}
