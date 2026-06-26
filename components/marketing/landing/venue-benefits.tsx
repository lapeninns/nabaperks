import { MonoTag } from "@/components/brand"

import { BenefitPoint } from "./benefit-point"
import { SampleLoyaltyCard } from "./sample-loyalty-card"
import { SealBreakDemo } from "./seal-break-demo"
import { type QrMatrix } from "./venue-qr"

/**
 * Venue benefits + live product proof. Mobile-first: the claims read first in a
 * single column, then the tappable card. From `lg` the copy and the card sit
 * side by side. The card is the same SampleLoyaltyCard as the hero, here holding
 * the interactive seal-break beat.
 */
export function VenueBenefits({ qrMatrix }: { qrMatrix: QrMatrix }) {
  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-4 lg:grid-cols-2 lg:items-center lg:gap-14">
      <div>
        <MonoTag tone="plain">Built for venues</MonoTag>
        <h2 className="mt-4 max-w-[15ch] text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          Built for the counter, not the boardroom.
        </h2>
        <ul className="mt-7 grid gap-5">
          <BenefitPoint title="No app, no plastic">
            Customers keep their phone and their pocket. Nothing to download,
            nothing to laminate.
          </BenefitPoint>
          <BenefitPoint title="The phone never crosses the counter">
            Stamps are confirmed on the customer&apos;s own phone. Your team
            never has to hold it.
          </BenefitPoint>
          <BenefitPoint title="One stamp a day, honest">
            The server allows a single stamp per UK business day. No
            double-tapping the same card.
          </BenefitPoint>
          <BenefitPoint title="Mystery rewards bring people back">
            A sealed reward from your pool gives regulars a reason for the third
            visit.
          </BenefitPoint>
          <BenefitPoint title="Built for food and drink venues">
            Made for cafes, takeaways, casual restaurants, pubs and dessert
            shops — not generic loyalty software.
          </BenefitPoint>
        </ul>
      </div>

      <div>
        <p className="text-center font-mono text-[0.7rem] font-bold tracking-[0.08em] text-primary uppercase">
          Live product shape
        </p>
        <p className="mt-1.5 text-center font-mono text-[0.65rem] tracking-[0.05em] text-muted-foreground uppercase">
          Card, reward, and QR kit in one setup flow
        </p>
        <div className="mt-6">
          <SampleLoyaltyCard
            className="-rotate-[1.4deg]"
            venue="The Old Crown · Bristol"
            title="Free flat white"
            venueInitials="OC"
            stamps={{ current: 3, total: 3, dates: ["3 JUN", "9 JUN", "24 JUN"] }}
            bodyClassName="grid min-h-[13.5rem] place-items-center"
            footerLeft="Card Nº OC-0248"
            footerRight={<span className="text-primary">Reward ready</span>}
          >
            <SealBreakDemo qrMatrix={qrMatrix} />
          </SampleLoyaltyCard>
        </div>
      </div>
    </section>
  )
}
