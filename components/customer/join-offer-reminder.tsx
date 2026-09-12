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
      className="flex min-w-0 items-center gap-3 border-y-2 border-dashed border-line-strong py-3 text-left"
    >
      <VenueMark name={venueName} size={40} />
      <div className="grid min-w-0 gap-1">
        <p className="mono-id break-words text-cobalt">
          {venueName} · offer in progress
        </p>
        {offer.campaignName ? (
          <p className="text-sm leading-5 font-extrabold break-words">
            {offer.campaignName}
          </p>
        ) : null}
        <p className="text-sm leading-5 font-bold">
          {offerClaimHeadline(offer.bonusStampCount, offer.discountPercent)}
        </p>
      </div>
    </aside>
  )
}
