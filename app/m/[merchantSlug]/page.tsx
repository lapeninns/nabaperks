import Link from "next/link"
import { notFound } from "next/navigation"

import { Eyebrow, MonoTag, ReceiptCard, VenueMark } from "@/components/brand"
import { CustomerShell } from "@/components/layout"
import {
  ProgressTrack,
  RewardTeaser,
  StampGrid,
  StatusBanner,
} from "@/components/loyalty"
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
    <CustomerShell className="grid content-center gap-5">
      <div className="grid gap-2 text-center">
        <Eyebrow>No app loyalty</Eyebrow>
        <h1 className="text-3xl leading-tight font-extrabold text-balance">
          {merchant.business_name} Rewards
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Your first stamp is waiting. Scan, join, and collect visit stamps from
          your browser — no app to download.
        </p>
      </div>

      <ReceiptCard
        edge
        wrapperClassName="w-full"
        className="grid gap-5"
        aria-label="Loyalty card preview"
      >
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1 text-left">
              <Eyebrow>{merchant.business_name}</Eyebrow>
              <p className="text-xl leading-tight font-extrabold">
                {loyaltyCard.card_name}
              </p>
            </div>
            <div className="grid justify-items-end gap-2">
              <VenueMark size={56} name={merchant.business_name} />
              <MonoTag tone="sun">Mystery</MonoTag>
            </div>
          </div>

          <hr className="w-rule" />

          <StampGrid current={0} total={loyaltyCard.stamps_required} />

          <ProgressTrack
            current={0}
            total={loyaltyCard.stamps_required}
            label="Visits to reward"
            className="rounded-lg bg-accent p-4"
          />

          <RewardTeaser
            locked
            title={loyaltyCard.card_name}
            description={
              <>
                Collect {loyaltyCard.stamps_required} stamps to reveal a mystery
                reward at the counter.
              </>
            }
            className="text-left"
          />

          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Nabaperks loyalty
            </span>
            <span className="font-mono text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              No app · no plastic
            </span>
          </div>
      </ReceiptCard>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href={`/m/${merchantSlug}/join`}>Join rewards</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href={`/merchant/${merchantSlug}/terms`}>View reward terms</Link>
        </Button>
      </div>
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

