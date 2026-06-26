"use client"

import { GiftIcon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { WetInkBreathe, WetInkPop, WetInkWiggle } from "@/components/motion"
import { cn } from "@/lib/utils"

const DISC: Record<"sm" | "md", string> = {
  sm: "size-9",
  md: "size-12 text-2xl",
}

/** Matches {@link RewardSeal} icon sizing — tuned to read as a box, not a blur. */
const GIFT_PX: Record<"sm" | "md", number> = {
  sm: 17,
  md: 26,
}

/**
 * Mystery reward gift — leaf-green disc with the same gift-box mark as the hero
 * card's unlocked {@link RewardSeal} ready state.
 */
export function MysteryRewardGift({
  label = "Mystery reward",
  size = "md",
  wiggle = false,
  breathe = false,
  slammed = false,
  className,
}: {
  label?: string
  size?: "sm" | "md"
  wiggle?: boolean
  breathe?: boolean
  slammed?: boolean
  className?: string
}) {
  return (
    <WetInkPop active={slammed} className="inline-grid shrink-0">
      <WetInkWiggle active={wiggle} className="inline-grid">
        <WetInkBreathe active={breathe} className="inline-grid">
          <span
            role="img"
            aria-label={label}
            data-mystery-reward-gift="ready"
            className={cn(
              "grid -rotate-6 place-items-center rounded-full border-2 border-ink bg-reward font-extrabold text-reward-foreground shadow-xs",
              DISC[size],
              className
            )}
          >
            <Icon icon={GiftIcon} size={GIFT_PX[size]} strokeWidth={2.25} />
          </span>
        </WetInkBreathe>
      </WetInkWiggle>
    </WetInkPop>
  )
}
