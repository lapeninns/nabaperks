import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import {
  RewardTeaser,
  StampJourneyPreview,
  StatusBanner,
} from "@/components/loyalty"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  ASK_TEAM_FOR_QR,
  CARD_UNAVAILABLE_TITLE,
  MYSTERY_REWARD_SEALED_LABEL,
} from "@/lib/copy/product-copy"
import { getMerchantJoinContext } from "@/lib/customer/join"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Collect your stamp",
}

type MerchantRewardsPageProps = {
  params: Promise<{
    merchantSlug: string
  }>
}

export default async function MerchantRewardsPage({
  params,
}: MerchantRewardsPageProps) {
  const { merchantSlug } = await params
  let context: Awaited<ReturnType<typeof getMerchantJoinContext>>

  try {
    context = await getMerchantJoinContext(merchantSlug)
  } catch {
    return <UnavailableLanding />
  }

  if (!context) {
    notFound()
  }

  if (!context.available) {
    return <UnavailableLanding />
  }

  const { merchant, loyaltyCard } = context

  return (
    <CustomerFlowShell
      eyebrow="No-app loyalty"
      title="Collect your stamp"
      description={`Save ${merchant.business_name}'s card to your number, collect ${loyaltyCard.stamps_required} stamps to unseal a mystery reward. No app, no plastic.`}
      dense
      className="content-center"
      screenLabel="Merchant loyalty preview"
    >
      {/* Compact identity card — no presumptuous "0 of N" grid, since this
          preview is shown to new and returning members alike. */}
      <CustomerReceipt
        venueName={merchant.business_name}
        title={loyaltyCard.card_name}
        eyebrow={merchant.business_name}
        hideFooter
        compact
      >
        {/* Same treatment as the q-valid join welcome (VCU-P2-02/03): the
            non-compact journey keeps the reward patch inline with the stamps
            at every width and prints the venue initials on earned stamps, so
            the card does not morph between adjacent steps. */}
        <StampJourneyPreview
          total={loyaltyCard.stamps_required}
          venueName={merchant.business_name}
          className="py-1"
        />
        <RewardTeaser
          locked
          hideSeal
          title={MYSTERY_REWARD_SEALED_LABEL}
          description={
            <>
              Collect {loyaltyCard.stamps_required} stamps to unseal a surprise
              reward, yours from the next UK business day.
            </>
          }
          className="min-w-0"
        />
      </CustomerReceipt>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={`/m/${merchantSlug}/join`}>Join rewards</Link>
        </Button>
        <CustomerVenueTermsSheet
          venueTerms={{
            merchantName: merchant.business_name,
            stampsRequired: loyaltyCard.stamps_required,
            rewardTerms: loyaltyCard.reward_terms,
            contact: [merchant.email, merchant.phone]
              .filter(Boolean)
              .join(" · "),
          }}
          triggerLabel="View reward terms"
          // The sheet's trigger is a plain button, so dress it with the real
          // secondary Button styles (focus ring, press, tokens) via buttonVariants
          // instead of hand-rolling them. no-underline cancels the trigger's
          // default text-link underline.
          triggerClassName={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "w-full no-underline"
          )}
        />
      </div>
    </CustomerFlowShell>
  )
}

function UnavailableLanding() {
  return (
    <CustomerFlowShell
      screenLabel="Unavailable loyalty"
      className="content-center"
    >
      <StatusBanner
        title={CARD_UNAVAILABLE_TITLE}
        tone="neutral"
        className="text-center"
      >
        {ASK_TEAM_FOR_QR}
      </StatusBanner>
      {/* Same recovery block as /q (CUS-P2-04) — never a dead end. */}
      <UnavailableRecoveryActions />
    </CustomerFlowShell>
  )
}
