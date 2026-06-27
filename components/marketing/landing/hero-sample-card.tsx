"use client"

import { useState } from "react"

import { RewardTicket, type RewardTicketState } from "@/components/loyalty"
import { useStampJourneyLoop } from "@/components/loyalty/use-stamp-journey-loop"
import { stampDisplayDatesEndingToday } from "@/lib/customer/uk-calendar"

import { heroSampleReward } from "./hero-sample-rewards"
import { CardScanRow, CardStampRow } from "./sample-card-rows"
import { SampleLoyaltyCard } from "./sample-loyalty-card"
import { type QrMatrix } from "./venue-qr"

const STAMP_TOTAL = 3
const HERO_CARD_NAME = "Mystery card"
const SEALED_REWARD_NAME = "Something's under there."

const HERO_REWARD_TICKET_CLASS =
  "min-h-[9rem] [&>div:first-child]:content-start [&_h3]:line-clamp-2 [&_p]:line-clamp-2"

function HeroRewardRow({
  revealed,
  revealSlam,
  reward,
}: {
  revealed: boolean
  revealSlam: boolean
  reward: string
}) {
  const state: RewardTicketState = revealed ? "ready" : "sealed"

  return (
    <RewardTicket
      state={state}
      name={revealed ? reward : SEALED_REWARD_NAME}
      description={
        revealed
          ? "Ready for merchant scan at the counter."
          : "Mystery reward stays sealed until the final stamp."
      }
      sealSlammed={revealSlam}
      className={HERO_REWARD_TICKET_CLASS}
    />
  )
}

/**
 * Hero sample card — stamps slam in one by one, then the mystery seal unlocks.
 * Loops gently for the landing hero; reduced motion shows the finished state.
 */
export function HeroSampleCard({ qrMatrix }: { qrMatrix: QrMatrix }) {
  const [stampDates] = useState(() => stampDisplayDatesEndingToday(STAMP_TOTAL))
  const { earnedCount, slamIndex, revealed, revealSlam, cycleIndex } =
    useStampJourneyLoop(STAMP_TOTAL)
  const reward = heroSampleReward(cycleIndex)

  return (
    <SampleLoyaltyCard
      className="rotate-[1.5deg]"
      shellClassName="flex flex-col gap-4 [&_.w-rule]:my-0"
      venue="Old Crown · CB3 0QD"
      title={HERO_CARD_NAME}
      venueInitials="OC"
      hideStampRow
      bodyClassName="grid gap-4"
      stamps={{
        current: earnedCount,
        total: STAMP_TOTAL,
      }}
      slamIndex={slamIndex}
    >
      <CardScanRow
        qrMatrix={qrMatrix}
        eyebrow="Scanned at the counter"
        title="Venue QR opens the card in the browser."
      />
      <CardStampRow
        current={earnedCount}
        total={STAMP_TOTAL}
        dates={stampDates.slice(0, earnedCount)}
        venueInitials="OC"
        showEmptySlotNumbers
        slamIndex={slamIndex}
      />
      <HeroRewardRow
        revealed={revealed}
        revealSlam={revealSlam}
        reward={reward}
      />
    </SampleLoyaltyCard>
  )
}
