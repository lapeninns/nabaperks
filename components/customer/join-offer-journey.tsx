"use client"

import { useState } from "react"

import { VenueMark } from "@/components/brand"
import {
  RewardSeal,
  StampJourneyRow,
  useStampJourneyLoop,
} from "@/components/loyalty"
import { WetInkShake, WetInkSoftStamp } from "@/components/motion"
import { joinUnlockingRewardHook } from "@/lib/customer/experience/copy"
import type { JoinCard, JoinMerchant } from "@/lib/customer/experience/types"
import { rewardExampleForCycle } from "@/lib/customer/reward-examples"
import { stampDisplayDates } from "@/lib/customer/uk-calendar"

/**
 * The welcome offer, told as a loop rather than a diagram: the row starts
 * empty, stamp one slams in and the card shudders under it (the moment the
 * headline promises), the rest follow, then the reward pops on the row and on
 * the header seal at once, and a mono caption narrates each beat. First paint
 * and reduced motion show the finished row with its caption, so the promise
 * reads even when nothing moves.
 */
export function JoinOfferJourney({
  merchant,
  card,
}: {
  merchant: JoinMerchant
  card: JoinCard
}) {
  const total = Math.max(card.stampsRequired, 0)
  const [previewDates] = useState(() => stampDisplayDates(total))
  const loop = useStampJourneyLoop(total)
  // A different pool item each time the loop comes round, so over a few
  // cycles the guest sees what the draw can land on — as examples, never as
  // the reward. First paint and reduced motion show the first item.
  const example = rewardExampleForCycle(card.rewardExamples, loop.cycleIndex)
  const beat = journeyBeat(loop.earnedCount, loop.revealed, total, example)

  return (
    <WetInkShake
      active={loop.slamIndex === 0}
      className="surface-card grid gap-3 p-3 text-left sm:p-4"
    >
      <div className="flex items-center gap-3">
        <VenueMark size={44} name={merchant.name} className="shrink-0" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="eyebrow text-muted-foreground">{merchant.name}</span>
          <span className="line-clamp-2 text-base leading-tight font-extrabold break-words">
            {card.name}
          </span>
        </div>
        {/* The header seal is the same object as the row's reward chip, so it
            pops on the same beat. */}
        <RewardSeal
          key={loop.revealKey}
          state="sealed"
          size="sm"
          wiggle
          slammed={loop.revealSlam}
          className="shrink-0"
        />
      </div>
      <StampJourneyRow
        total={total}
        venueName={merchant.name}
        previewDates={previewDates}
        earnedCount={loop.earnedCount}
        slamIndex={loop.slamIndex}
        revealed={loop.revealed}
        revealSlam={loop.revealSlam}
        revealKey={loop.revealKey}
      />
      <div className="grid gap-1">
        <span className="text-sm leading-snug font-semibold">
          {joinUnlockingRewardHook(total)}.
        </span>
        {/* Decorative narration: the row's list label already carries the
            journey for assistive tech. */}
        <span
          aria-hidden="true"
          className="mono-id tracking-[0.08em] text-muted-foreground"
        >
          <WetInkSoftStamp key={beat} active className="inline-block">
            {beat}
          </WetInkSoftStamp>
        </span>
      </div>
    </WetInkShake>
  )
}

function journeyBeat(
  earnedCount: number,
  revealed: boolean,
  total: number,
  example: string | null
): string {
  if (total === 0) return "Reward"
  if (revealed && earnedCount >= total) {
    return example ? `Could be… ${example}` : "Reward unlocked"
  }
  if (earnedCount === 0) return "Your first visit"
  const suffix = earnedCount === 1 ? " · today" : ""
  return `Stamp ${earnedCount} of ${total}${suffix}`
}
