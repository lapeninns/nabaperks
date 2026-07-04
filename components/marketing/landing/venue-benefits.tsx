import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { stampDisplayDatesEndingToday } from "@/lib/customer/uk-calendar"

import { BenefitPoint } from "./benefit-point"
import { VenueBenefitsCard } from "./venue-benefits-card"
import { type QrMatrix } from "./venue-qr"

/**
 * Venue benefits + live product proof. Mobile-first: the claims read first in a
 * single column, then the tappable card. From `lg` the copy and the card sit
 * side by side. The card previews merchant setup — programme, QR kit, and reward
 * config — not the hero's customer scan journey.
 */
export function VenueBenefits({ qrMatrix }: { qrMatrix: QrMatrix }) {
  const stampDates = stampDisplayDatesEndingToday(3)

  return (
    <Section
      size="tight"
      className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center lg:gap-8"
    >
      <div>
        <MonoTag tone="plain">Built for venues</MonoTag>
        <h2 className="mt-4 max-w-[15ch] text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          Built for the counter, not the boardroom.
        </h2>
        <ul className="mt-5 grid gap-4 sm:mt-6 sm:gap-5">
          <BenefitPoint title="Simple rewards customers understand">
            Start with one clear reward, then add a surprise reward later if it
            fits your venue — no points maths, no tiers to explain.
          </BenefitPoint>
          <BenefitPoint title="See your regulars, don&apos;t guess">
            Every visit and redemption lands in a weekly digest, so loyalty is
            something you can read — not a hunch about who keeps coming back.
          </BenefitPoint>
          <BenefitPoint title="Fits how your counter already runs">
            It works on the phone, tablet or till you already have — even
            cash-only — and your team never has to hold a customer&apos;s phone.
            Nothing to integrate; your permanent venue QR is ready when you go live.
          </BenefitPoint>
        </ul>
      </div>

      <div>
        <p className="mono-meta text-center tracking-[0.08em] text-primary">
          Your programme setup
        </p>
        <p className="mono-id mt-1.5 text-center font-normal text-muted-foreground">
          What you configure · what customers see
        </p>
        <div className="mt-6">
          <VenueBenefitsCard
            qrMatrix={qrMatrix}
            stampDates={stampDates}
          />
        </div>
      </div>
    </Section>
  )
}
