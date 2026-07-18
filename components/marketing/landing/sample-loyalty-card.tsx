import { ReceiptCard } from "@/components/brand"
import { StampJourneyPreview } from "@/components/loyalty"
import {
  MYSTERY_REWARD_SEALED_LABEL,
  SEALED_REWARD_NOTE,
} from "@/lib/copy/product-copy"

/**
 * The hero's sample loyalty card — the recommended 5-stamp cycle looping
 * through the shared journey preview, on a receipt surface. Clearly labelled a
 * sample; the venue name is Old Crown, one of the operator's own estate pubs.
 */
export function SampleLoyaltyCard({ className }: { className?: string }) {
  return (
    <ReceiptCard
      edge
      rotated
      padding="sm"
      wrapperClassName={className}
      className="gap-3 py-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono-meta text-muted-foreground">Sample card</span>
        <span className="mono-id text-muted-foreground">Old Crown</span>
      </div>
      <StampJourneyPreview total={5} venueName="Old Crown" compact />
      <div className="grid gap-1 border-t-2 border-dashed border-border pt-3">
        <span className="mono-id text-muted-foreground uppercase">
          {MYSTERY_REWARD_SEALED_LABEL}
        </span>
        <p className="text-xs leading-5 text-muted-foreground">
          {SEALED_REWARD_NOTE}
        </p>
      </div>
    </ReceiptCard>
  )
}
