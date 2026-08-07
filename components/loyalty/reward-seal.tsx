import {
  CheckmarkCircle02Icon,
  ClockIcon,
  GiftIcon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons"

import { Icon, type IconGlyph } from "@/components/brand"
import { WetInkBreathe, WetInkPop, WetInkWiggle } from "@/components/motion"
import { MYSTERY_REWARD_SEALED_LABEL } from "@/lib/copy/product-copy"
import { cn } from "@/lib/utils"

export type RewardSealState = "sealed" | "waiting" | "ready" | "redeemed"
export type RewardSealSize = "sm" | "md" | "lg"

/** The seal's mark per state — the redeemed check is earned only, never a promise. */
const GLYPH: Record<RewardSealState, IconGlyph> = {
  sealed: HelpCircleIcon,
  waiting: ClockIcon,
  ready: GiftIcon,
  redeemed: CheckmarkCircle02Icon,
}

/** Icon px per seal size, tuned to sit inside the disc. */
const ICON_PX: Record<RewardSealSize, number> = {
  sm: 12,
  md: 26,
  lg: 48,
}

const DEFAULT_LABEL: Record<RewardSealState, string> = {
  sealed: MYSTERY_REWARD_SEALED_LABEL,
  waiting: "Reward unlocked, resting until it's ready",
  ready: "Reward ready for merchant scan",
  redeemed: "Reward redeemed",
}

const SIZE: Record<RewardSealSize, string> = {
  // 0.625rem is the mono-id floor — nothing in the system prints below 10px.
  sm: "size-5 text-micro",
  md: "size-12 text-2xl",
  lg: "size-24 text-4xl",
}

/**
 * The single seal of the reward family — one component, three sizes (stamp-row
 * chip → ticket stub → full celebration beat), so the mystery "?" stops
 * repeating as four unrelated marks. Sun while sealed/waiting, leaf once
 * ready/redeemed, always rotated -6°. The idle wiggle is reserved for the
 * sealed mystery and the resting breathe for the waiting/ready states; ✓
 * appears on the redeemed state only.
 */
export function RewardSeal({
  state,
  size = "md",
  label,
  wiggle = false,
  breathe = false,
  slammed = false,
  className,
}: {
  state: RewardSealState
  size?: RewardSealSize
  /** Override the state's default aria-label (e.g. to name the reward). */
  label?: string
  /** Idle wiggle — only ever honoured on the sealed mystery. */
  wiggle?: boolean
  /** Resting breathe — only ever honoured while waiting/ready (the awaiting pulse). */
  breathe?: boolean
  /** Fire the print-pop keyframe on reveal / redeem. */
  slammed?: boolean
  className?: string
}) {
  const leaf = state === "ready" || state === "redeemed"
  // The idle wiggle is reserved for the sealed mystery only.
  const idleWiggle = wiggle && state === "sealed"
  // The resting breathe is reserved for the unlocked-but-not-done states:
  // waiting (resting out its rest day) and ready (awaiting the counter scan).
  const idleBreathe = breathe && (state === "waiting" || state === "ready")

  return (
    <WetInkPop active={slammed} className="inline-grid">
      <WetInkWiggle active={idleWiggle} className="inline-grid">
        <WetInkBreathe active={idleBreathe} className="inline-grid">
          <span
            role="img"
            aria-label={label ?? DEFAULT_LABEL[state]}
            data-reward-seal={state}
            className={cn(
              "grid -rotate-6 place-items-center rounded-full border-2 border-ink font-extrabold shadow-xs",
              SIZE[size],
              leaf
                ? "bg-reward text-reward-foreground"
                : "bg-seal text-seal-foreground",
              className
            )}
          >
            <Icon icon={GLYPH[state]} size={ICON_PX[size]} strokeWidth={2.25} />
          </span>
        </WetInkBreathe>
      </WetInkWiggle>
    </WetInkPop>
  )
}
