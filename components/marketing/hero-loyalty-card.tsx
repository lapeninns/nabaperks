"use client"

import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { DemoQr } from "@/components/marketing/demo-qr"
import { QrFrame, RewardSeal, StampGrid } from "@/components/loyalty"
import { WetInkFloat, WetInkRise } from "@/components/motion"
import { cn } from "@/lib/utils"

const STAMP_TOTAL = 3
const HERO_STAMP_COUNT = 2
const DEMO_VENUE = "Nabaperks"
const DEMO_POSTCODE = "NP1 0RK"
const DEMO_INITIALS = "NP"

/**
 * Marketing hero product object — static resting card with a gentle float.
 * The how-it-works phone loop carries the animated product story.
 */
export function MarketingHeroLoyaltyCard({
  className,
}: {
  className?: string
}) {
  return (
    <WetInkRise
      className={cn(
        "w-full min-w-0",
        className ?? "justify-self-center lg:justify-self-end"
      )}
      delay={0.08}
    >
      <WetInkFloat className="mx-auto w-full min-w-0 max-w-[22rem] lg:mx-0">
        <ReceiptCard edge className="w-full gap-4 p-5 sm:gap-5 sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0 grid gap-1.5">
              <Eyebrow>
                {DEMO_VENUE} · {DEMO_POSTCODE}
              </Eyebrow>
              <p className="text-[clamp(1.2rem,4.8vw,1.5rem)] leading-tight font-extrabold text-pretty">
                Mystery reward after {STAMP_TOTAL} visits
              </p>
            </div>
            <VenueMark size={48} initials={DEMO_INITIALS} className="shrink-0" />
          </div>
          <StampGrid
            current={HERO_STAMP_COUNT}
            total={STAMP_TOTAL}
            slamIndex={-1}
            showEmptySlotNumbers
            venueName={DEMO_VENUE}
            venueInitials={DEMO_INITIALS}
          />
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <RewardSeal
              state="sealed"
              size="md"
              label="Mystery reward, sealed"
              wiggle
              className="shrink-0"
            />
            <p className="min-w-0 text-sm leading-5 font-bold text-pretty text-muted-foreground">
              Mystery reward stays sealed until visit {STAMP_TOTAL}.
            </p>
          </div>
          <hr className="w-rule" />
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <QrFrame label="Demo QR code for joining a no-app loyalty card">
              <DemoQr />
            </QrFrame>
            <div className="min-w-0 grid gap-1">
              <Eyebrow>Scan to join</Eyebrow>
              <p className="text-sm leading-5 font-bold text-pretty">
                One scan opens the card. No app store in the way.
              </p>
            </div>
          </div>
        </ReceiptCard>
      </WetInkFloat>
    </WetInkRise>
  )
}
