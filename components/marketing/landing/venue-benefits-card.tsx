import { RewardSeal } from "@/components/loyalty"

import { CardInfoRow } from "./sample-card-rows"
import { SampleLoyaltyCard } from "./sample-loyalty-card"
import { VenueQr, type QrMatrix } from "./venue-qr"

const STAMP_TOTAL = 4
const STAMPS_EARNED = 3

/**
 * Merchant setup preview for the venue-benefits section — the customer card
 * shape up top (stamps + programme title), then what the venue configures:
 * permanent venue QR and clear reward terms. Not the hero's scan journey.
 */
export function VenueBenefitsCard({
  qrMatrix,
  stampDates,
}: {
  qrMatrix: QrMatrix
  stampDates: string[]
}) {
  return (
    <SampleLoyaltyCard
      className="-rotate-[1.4deg]"
      venue="The Old Crown · Bristol"
      title="Free flat white after 4 stamps"
      venueInitials="OC"
      stamps={{
        current: STAMPS_EARNED,
        total: STAMP_TOTAL,
        dates: stampDates,
      }}
      bodyClassName="grid gap-3"
      footerLeft="Card Nº OC-0248"
      footerRight={
        <span className="text-muted-foreground">One stamp left</span>
      }
    >
      <CardInfoRow
        icon={<VenueQr matrix={qrMatrix} label="Venue QR kit preview" />}
        eyebrow="Your venue QR"
        title="One permanent scan point for joins, stamps, and rewards."
      />
      <CardInfoRow
        icon={<RewardSeal state="sealed" size="md" />}
        eyebrow="Your reward setup"
        title="Clear reward terms, shown to customers before go-live."
        framed={false}
      />
    </SampleLoyaltyCard>
  )
}
