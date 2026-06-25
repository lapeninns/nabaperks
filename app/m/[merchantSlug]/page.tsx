import Link from "next/link"
import { notFound } from "next/navigation"

import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { CustomerVenueTermsSheet } from "@/components/customer/legal-sheet"
import {
  RewardTeaser,
  StampJourneyPreview,
  StatusBanner,
} from "@/components/loyalty"
import { Button, buttonVariants } from "@/components/ui/button"
import { getMerchantJoinContext } from "@/lib/customer/join"
import { cn } from "@/lib/utils"

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
      eyebrow="No app loyalty"
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
      >
        <StampJourneyPreview
          total={loyaltyCard.stamps_required}
          className="py-1"
        />
        <RewardTeaser
          locked
          hideSeal
          title="Mystery reward, sealed"
          description={
            <>
              Collect {loyaltyCard.stamps_required} stamps to unseal a surprise
              reward, yours from the next UK business day.
            </>
          }
        />
      </CustomerReceipt>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={`/m/${merchantSlug}/join`}>{"Get today's stamp"}</Link>
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
        title="This loyalty card is unavailable"
        tone="neutral"
        className="text-center"
      >
        Ask a team member for the current loyalty QR.
      </StatusBanner>
    </CustomerFlowShell>
  )
}
