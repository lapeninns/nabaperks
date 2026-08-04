import {
  DiscountTag01Icon,
  GiftCardIcon,
  StampIcon,
} from "@hugeicons/core-free-icons"

import { Eyebrow, MonoTag, ReceiptCard } from "@/components/brand"
import type { IconGlyph } from "@/components/brand/icon"
import { OfferClaimLanding } from "@/components/customer/offer-claim-landing"
import { Button } from "@/components/ui/button"
import type { OfferBenefitKind } from "@/lib/offers/constants"

/**
 * Step three's "what the customer sees" — which is the customer's own screen,
 * not a merchant-side description of it.
 *
 * The body is {@link OfferClaimLanding}, the single component the real
 * /offer/[token] landing renders, given the values the draft will be created
 * with. Every sentence, the stamp row and the discount pass face are therefore
 * the customer's, and there is no second wording that can fall behind.
 *
 * Only the frame differs, and deliberately: the preview is labelled as one and
 * its claim button is switched off, so a merchant reviewing an unpublished
 * offer cannot claim it from the review step.
 */

export type OfferBenefitPreset = {
  readonly kind: OfferBenefitKind
  readonly title: string
  readonly description: string
  readonly icon: IconGlyph
}

/**
 * The three benefit presets, shared by the empty state on the Offers hub and by
 * step one of the creator so both name the same three things.
 */
export const OFFER_BENEFIT_PRESETS: readonly OfferBenefitPreset[] = [
  {
    kind: "bonus_stamps",
    title: "Welcome stamps",
    description:
      "New members start with stamps already on their card, so their first reward feels within reach.",
    icon: StampIcon,
  },
  {
    kind: "discount",
    title: "Discount pass",
    description:
      "New members get a percentage off the whole bill, as often as they like while the offer runs.",
    icon: DiscountTag01Icon,
  },
  {
    kind: "both",
    title: "Welcome stamps and a discount pass",
    description:
      "Both benefits, given together the moment someone joins through the offer link.",
    icon: GiftCardIcon,
  },
] as const

export type OfferBenefitPreviewProps = {
  readonly venueName: string
  /** The campaign's name, shown to the customer above the promise. */
  readonly campaignName: string | null
  /** The merchant's own line about the offer, shown under the promise. */
  readonly customerDescription: string | null
  readonly bonusStampCount: number | null
  readonly discountPercent: number | null
  readonly requiresIdCheck: boolean
  readonly extraTerms: string | null
  readonly startsOn: string | null
  readonly endsOn: string | null
  /** The venue's active card length; 0 hides the stamp row. */
  readonly stampsRequired: number
  readonly rewardName: string | null
}

export function OfferBenefitPreview({
  venueName,
  campaignName,
  customerDescription,
  bonusStampCount,
  discountPercent,
  requiresIdCheck,
  extraTerms,
  startsOn,
  endsOn,
  stampsRequired,
  rewardName,
}: OfferBenefitPreviewProps) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>What the customer sees</Eyebrow>
        <MonoTag tone="plain">Preview</MonoTag>
      </div>

      <ReceiptCard edge className="grid gap-4" padding="sm">
        <OfferClaimLanding
          venueName={venueName}
          campaignName={campaignName}
          customerDescription={customerDescription}
          bonusStampCount={bonusStampCount}
          discountPercent={discountPercent}
          stampsRequired={stampsRequired}
          rewardName={rewardName}
          requiresIdCheck={requiresIdCheck}
          extraTerms={extraTerms}
          startsOn={startsOn}
          endsOn={endsOn}
          headingLevel="h3"
          claimAction={
            <Button type="button" size="lg" className="w-full" disabled>
              Claim this offer
            </Button>
          }
        />
      </ReceiptCard>

      <p className="text-xs leading-5 text-muted-foreground">
        This is the page your link opens. The claim button is switched off here
        — only a customer opening your link can claim.
      </p>
    </div>
  )
}
