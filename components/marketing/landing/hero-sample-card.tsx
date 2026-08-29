"use client"

import { useRef, useState } from "react"

import { RewardTicket, type RewardTicketState } from "@/components/loyalty"
import { useOnScreen } from "@/lib/motion/use-on-screen"
import { useStampJourneyLoop } from "@/components/loyalty/use-stamp-journey-loop"
import { stampDisplayDatesEndingToday } from "@/lib/customer/uk-calendar"
import { SEALED_REWARD_NAME } from "@/lib/copy/product-copy"

import { heroSampleReward } from "./hero-sample-rewards"
import type { QrMatrix } from "./qr-matrix"
import { CardScanRow, CardStampRow } from "./sample-card-rows"
import { SampleLoyaltyCard } from "./sample-loyalty-card"

const STAMP_TOTAL = 3
const HERO_CARD_NAME = "Mystery card"

// The reward name renders as a `p` here (see `headingLevel` below), so the one
// paragraph clamp covers both the name and its description.
const HERO_REWARD_TICKET_CLASS =
  "min-h-[7rem] sm:min-h-[9rem] [&>div:first-child]:content-start [&_p]:line-clamp-2"

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
      // Illustration, not structure: as an `h2` this sample reward name was
      // the first heading in the outline on every page that mounts the hero
      // card, outranking each real section heading below it.
      headingLevel="p"
    />
  )
}

/**
 * Hero sample card — stamps slam in one by one, then the mystery seal unlocks.
 * Loops gently for the landing hero; reduced motion shows the finished state.
 *
 * WCAG 2.2.2: the cycle runs ~5.9s and repeats for as long as the page is
 * open, on `/` and on `/loyalty-for-pubs`. `prefers-reduced-motion` is honoured
 * inside the hook, but 2.2.2 also requires a mechanism for users who have not
 * set that flag — `WetInkMarquee` got one for exactly this reason, and this
 * card is the more assertive animation of the two. The toggle freezes the card
 * on the finished frame, which is the same rest state SSR and reduced motion
 * render, so pausing never leaves a half-stamped card on screen.
 */
export function HeroSampleCard({ qrMatrix }: { qrMatrix: QrMatrix }) {
  const [stampDates] = useState(() => stampDisplayDatesEndingToday(STAMP_TOTAL))
  const [playing, setPlaying] = useState(true)
  const cardRef = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(cardRef)
  // Genuinely stop the loop rather than masking it: the hook now schedules
  // nothing while paused. Off-screen counts as paused — the card is mounted in
  // the hero of two long pages, and a ~5.9s scheduling chain has no business
  // running while it is scrolled out of sight.
  //
  // (Wording note: marketing-offer-source greps this file for scarcity words
  // and matches raw source, comments included.)
  const loop = useStampJourneyLoop(STAMP_TOTAL, {
    paused: !playing || !onScreen,
  })
  const { earnedCount, slamIndex, revealed, revealSlam } = loop
  const reward = heroSampleReward(loop.cycleIndex)

  return (
    <div ref={cardRef} className="grid gap-2">
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
      <button
        type="button"
        aria-pressed={!playing}
        onClick={() => setPlaying((wasPlaying) => !wasPlaying)}
        className="focus-ring mono-id tap-floor inline-flex min-h-11 items-center justify-self-end rounded-(--radius-md) px-2 text-muted-foreground uppercase hover:text-foreground"
      >
        {playing ? "Pause the demo" : "Play the demo"}
      </button>
    </div>
  )
}
