import Link from "next/link"
import { notFound } from "next/navigation"

import { Eyebrow } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import { ProgressTrack, RewardTeaser, StatusBanner } from "@/components/loyalty"
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

  return (
    <CustomerShell className="grid content-center">
      <section className="surface-card grid gap-5 rounded-[2rem] border bg-card p-6 text-center shadow-xs">
        <div className="grid gap-2">
          <Eyebrow>No app loyalty</Eyebrow>
          <h1 className="text-3xl font-extrabold leading-tight text-balance">
            {context.merchant.business_name} Rewards
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Scan, join, and collect visit stamps from your browser — no app
            download needed.
          </p>
        </div>

        <RewardTeaser
          locked
          title={context.loyaltyCard.card_name}
          description={
            <>
              Collect {context.loyaltyCard.stamps_required} stamps to reveal a
              mystery reward at the counter.
            </>
          }
          className="text-left"
        />

        <ProgressTrack
          current={0}
          total={context.loyaltyCard.stamps_required}
          label="Visits to reward"
          className="rounded-3xl border bg-background p-4 text-left"
        />

        <div className="grid gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href={`/m/${merchantSlug}/join`}>Join rewards</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={`/merchant/${merchantSlug}/terms`}>
              View reward terms
            </Link>
          </Button>
        </div>
      </section>
    </CustomerShell>
  )
}

function UnavailableLanding() {
  return (
    <CustomerShell className="grid content-center">
      <StatusBanner
        title="This loyalty card is unavailable"
        tone="neutral"
        className="text-center"
      >
        Ask a team member for the current loyalty QR.
      </StatusBanner>
    </CustomerShell>
  )
}
