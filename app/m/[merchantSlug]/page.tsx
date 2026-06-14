import Link from "next/link"
import { notFound } from "next/navigation"

import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { LoyaltyJourneyIllustration } from "@/components/customer/loyalty-journey-illustration"
import { StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getMerchantJoinContext } from "@/lib/customer/join"

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
      description={`Save ${merchant.business_name}'s card to your number — collect ${loyaltyCard.stamps_required} stamps to unseal a mystery reward. No app, no plastic.`}
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
        <LoyaltyJourneyIllustration
          stampsRequired={loyaltyCard.stamps_required}
          minSpendLabel={
            loyaltyCard.min_spend_pence !== null
              ? `Minimum spend ${formatPence(loyaltyCard.min_spend_pence)}.`
              : undefined
          }
        />
      </CustomerReceipt>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={`/m/${merchantSlug}/join`}>Collect my stamp</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href={`/merchant/${merchantSlug}/terms`}>
            View reward terms
          </Link>
        </Button>
      </div>
    </CustomerFlowShell>
  )
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
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
