"use client"

import { useState } from "react"

import { RewardTicket, type RewardTicketState } from "@/components/loyalty"
import { useStampJourneyLoop } from "@/components/loyalty/use-stamp-journey-loop"
import { stampDisplayDatesEndingToday } from "@/lib/customer/uk-calendar"
import { SEALED_REWARD_NAME } from "@/lib/copy/product-copy"

import { heroSampleReward } from "./hero-sample-rewards"
import type { QrMatrix } from "./qr-matrix"
import { CardScanRow, CardStampRow } from "./sample-card-rows"
import { SampleLoyaltyCard } from "./sample-loyalty-card"

const STAMP_TOTAL = 3
const HERO_CARD_NAME = "Mystery card"

const HERO_REWARD_TICKET_CLASS =
  "min-h-[7rem] sm:min-h-[9rem] [&>div:first-child]:content-start [&_h2]:line-clamp-2 [&_p]:line-clamp-2"

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
          ? "Ready for staff to scan in the merchant app."
          : // Short enough to never hit the ticket's two-line clamp — the
            // sealed name above already carries the mystery.
            "Stays sealed until the final stamp."
      }
      sealSlammed={revealSlam}
      className={HERO_REWARD_TICKET_CLASS}
      headingLevel="h2"
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
      className="max-sm:rotate-[0.75deg] sm:rotate-[1.5deg]"
      shellClassName="flex flex-col gap-3 sm:gap-4 [&_.w-rule]:my-0"
      venue="Old Crown · CB3 0QD"
      title={HERO_CARD_NAME}
      venueInitials="OC"
      hideStampRow
      bodyClassName="grid gap-3 sm:gap-4"
      stamps={{
        current: earnedCount,
        total: STAMP_TOTAL,
      }}
      slamIndex={slamIndex}
    >
      {/* QR on the same phone you are reading cannot be scanned — keep the
          scan beat from sm up; phones get stamps + reward only. */}
      <div className="hidden sm:block">
        <CardScanRow
          qrMatrix={qrMatrix}
          eyebrow="Venue QR scanned"
          title="Venue QR opens the card in the browser."
        />
      </div>
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
