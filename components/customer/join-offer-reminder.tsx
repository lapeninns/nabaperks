import { VenueMark } from "@/components/brand"
import { offerClaimHeadline } from "@/components/loyalty/offer-pass-copy"
import type { PendingJoinOffer } from "@/lib/customer/pending-join-offer"

export function JoinOfferReminder({
  offer,
  venueName,
}: {
  offer: PendingJoinOffer
  venueName: string
}) {
  return (
    <aside
      aria-label="Offer in progress"
      className="surface-card flex min-w-0 items-center gap-3 p-3 text-left"
    >
      <VenueMark name={venueName} size={40} className="shrink-0" />
      <div className="grid min-w-0 gap-1">
        <p className="eyebrow break-words text-muted-foreground">
          {venueName} · offer in progress
        </p>
        {offer.campaignName ? (
          <p className="text-sm leading-5 font-extrabold break-words">
            {offer.campaignName}
          </p>
        ) : null}
        <p className="text-xs leading-snug text-muted-foreground">
          {offerClaimHeadline(offer.bonusStampCount, offer.discountPercent)}
        </p>
      </div>
    </aside>
  )
}
