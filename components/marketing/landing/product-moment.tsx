import type { ReactNode } from "react"

import { Section } from "@/components/layout"
import { RewardTicket, StampGrid } from "@/components/loyalty"
import { WetInkRise } from "@/components/motion"
import { LANDING } from "@/lib/marketing/facts"

import type { QrMatrix } from "./qr-matrix"
import { VenueQr } from "./venue-qr"

/**
 * The page's one dominant composition. It does not repeat the hero card — it
 * shows the same receipt in a different state, disassembled into the three
 * objects it is built from (venue QR, stamp row, reward ticket) at a size no
 * other band gets. Replaces the emotional job of the old ProblemPains,
 * LaunchProcess, FeaturesListicle and OutcomeTransformation bands.
 */
export function ProductMoment({ demoQr }: { demoQr: QrMatrix }) {
  const [scan, stamp, reward] = LANDING.moment.beats

  return (
    <Section id="how" size="default">
      <h2 className="max-w-2xl text-2xl leading-tight font-extrabold text-balance text-foreground sm:text-3xl">
        {LANDING.moment.title}
      </h2>
      {/* 01#11: three-across from `sm:`, not `md:`. The audit asked for
          `grid-cols-3` at the BASE breakpoint; measured on a production build
          that shrinks the venue QR from 148px to 60px at 375/390px, which
          destroys the object the beat exists to show, so the base breakpoint
          keeps one column. From `sm:` the QR stays at its full 148px and the
          band drops 109px at 640, 195px at 700 and 219px at 767 (764px -> 655
          / 569 / 545), with zero elements past the viewport. */}
      <div className="grid gap-8 pt-8 sm:grid-cols-3 sm:pt-10 lg:gap-10">
        <Beat caption={scan.caption} detail={scan.detail} delay={0}>
          <div className="w-full max-w-[11rem]">
            <VenueQr matrix={demoQr} label="Example venue QR code" />
          </div>
        </Beat>
        <Beat caption={stamp.caption} detail={stamp.detail} delay={0.09}>
          {/* `flow="horizontal"` is load-bearing: the adaptive default wraps
              each slot onto its own line in a third-width column, which reads
              as a vertical track and contradicts the card's horizontal row. */}
          <div className="w-full max-w-[13rem]">
            <StampGrid
              current={2}
              total={3}
              rewardSlot="locked"
              layout="row"
              flow="horizontal"
            />
          </div>
        </Beat>
        <Beat caption={reward.caption} detail={reward.detail} delay={0.18}>
          <RewardTicket
            state="ready"
            name="A free hot drink"
            description="Ready for staff to scan in the merchant app."
          />
        </Beat>
      </div>
      <p className="pt-8 text-lg leading-snug font-extrabold text-balance text-foreground sm:pt-10 sm:text-xl">
        {LANDING.moment.closing}
      </p>
    </Section>
  )
}

function Beat({
  caption,
  detail,
  delay,
  children,
}: {
  caption: string
  detail: string
  /** Stagger offset (seconds) so the three beats rise in scan → stamp → reward order. */
  delay: number
  children: ReactNode
}) {
  return (
    // The beats are grid items, so they already stretch to equal height. Making
    // the visual area `flex-1` lets it absorb the leftover space in each column,
    // which lands all three captions on one baseline without pinning a
    // min-height to the tallest visual. The WetInkRise wrapper is the grid
    // item; it staggers each beat as the band scrolls into view.
    <WetInkRise inView distance={16} delay={delay} className="h-full">
      <div className="flex h-full flex-col gap-5">
        <div className="grid flex-1 place-items-center">{children}</div>
        <div className="grid gap-1">
          <h3 className="text-lg leading-snug font-extrabold text-foreground">
            {caption}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </WetInkRise>
  )
}
