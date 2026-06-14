import { cn } from "@/lib/utils"

export type RewardSealState = "sealed" | "waiting" | "ready" | "redeemed"
export type RewardSealSize = "sm" | "md" | "lg"

/** The seal's mark per state — ✓ is earned (redeemed) only, never a promise. */
const GLYPH: Record<RewardSealState, string> = {
  sealed: "?",
  waiting: "✱",
  ready: "✱",
  redeemed: "✓",
}

const DEFAULT_LABEL: Record<RewardSealState, string> = {
  sealed: "Mystery reward, sealed",
  waiting: "Reward unlocked, resting until it's ready",
  ready: "Reward ready to redeem",
  redeemed: "Reward redeemed",
}

const SIZE: Record<RewardSealSize, string> = {
  sm: "size-5 text-[0.62rem]",
  md: "size-12 text-2xl",
  lg: "size-24 text-4xl",
}

/**
 * The single seal of the reward family — one component, three sizes (stamp-row
 * chip → ticket stub → full celebration beat), so the mystery "?" stops
 * repeating as four unrelated marks. Sun while sealed/waiting, leaf once
 * ready/redeemed, always rotated -6°. The idle wiggle is reserved for the
 * sealed mystery; ✓ appears on the redeemed state only.
 */
export function RewardSeal({
  state,
  size = "md",
  label,
  wiggle = false,
  slammed = false,
  className,
}: {
  state: RewardSealState
  size?: RewardSealSize
  /** Override the state's default aria-label (e.g. to name the reward). */
  label?: string
  /** Idle wiggle — only ever honoured on the sealed mystery. */
  wiggle?: boolean
  /** Fire the print-pop keyframe on reveal / redeem. */
  slammed?: boolean
  className?: string
}) {
  const leaf = state === "ready" || state === "redeemed"

  return (
    <span
      role="img"
      aria-label={label ?? DEFAULT_LABEL[state]}
      data-reward-seal={state}
      style={
        slammed
          ? { animation: "w-pop 420ms var(--w-ease-slam) both" }
          : undefined
      }
      className={cn(
        "grid -rotate-6 place-items-center rounded-full border-2 border-ink font-extrabold shadow-xs",
        SIZE[size],
        leaf
          ? "bg-reward text-reward-foreground"
          : "bg-seal text-seal-foreground",
        wiggle && state === "sealed"
          ? "motion-safe:animate-[w-wiggle_2.6s_ease-in-out_infinite]"
          : null,
        className
      )}
    >
      <span aria-hidden="true" className="leading-none">
        {GLYPH[state]}
      </span>
    </span>
  )
}
