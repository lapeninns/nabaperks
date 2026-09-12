import { Eyebrow, ReceiptCard, VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty/stamp-grid"

/** Actual venue configuration, illustrated before consent; never a grant. */
export function OfferCardPreview({
  venueName,
  current,
  total,
  rewardName,
  headingLevel: Heading = "h2",
}: {
  venueName: string | null
  current: number
  total: number
  rewardName: string | null
  headingLevel?: "h2" | "h3" | "h4"
}) {
  const remaining = Math.max(total - current, 0)
  return (
    <ReceiptCard
      padding="sm"
      className="grid gap-4"
      aria-label={`${venueName ?? "Venue"} loyalty card`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <Eyebrow>Loyalty card</Eyebrow>
          {venueName ? (
            <Heading className="text-xl leading-tight font-extrabold break-words">
              {venueName}
            </Heading>
          ) : null}
        </div>
        {venueName ? <VenueMark name={venueName} size={44} /> : null}
      </div>
      <StampGrid
        current={current}
        total={total}
        layout="wrap"
        wrapColumns={Math.min(total + 1, 4)}
        rewardSlot="locked"
        venueName={venueName ?? undefined}
        showEmptySlotNumbers
        receiptCaptions
        className="py-2"
      />
      <hr className="w-rule my-0" />
      <p className="text-sm leading-5">
        {remaining === 0
          ? "Once you join, your card reaches "
          : remaining === 1
            ? "One more visit and you reach "
            : `${remaining} more visits and you reach `}
        <strong>{rewardName ?? "your reward"}.</strong>
      </p>
    </ReceiptCard>
  )
}
