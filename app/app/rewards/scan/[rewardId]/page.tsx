import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { RewardScanContentSkeleton } from "@/components/merchant/loading-skeletons"
import { MerchantRewardCollectionForm } from "@/components/merchant/reward-collection-form"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { loadMerchantRewardScanContext } from "@/lib/merchant/reward-collection"

type MerchantRewardScanPageProps = {
  params: Promise<{
    rewardId: string
  }>
  searchParams?: Promise<{
    collected?: string | string[]
  }>
}

export default async function MerchantRewardScanPage({
  params,
  searchParams,
}: MerchantRewardScanPageProps) {
  const { rewardId } = await params
  const scanToken = rewardId
  const query = searchParams ? await searchParams : {}
  const collected = firstParam(query.collected) === "1"

  return (
    <ScanShell>
      <Suspense fallback={<RewardScanContentSkeleton />}>
        <RewardScanStream scanToken={scanToken} collected={collected} />
      </Suspense>
    </ScanShell>
  )
}

async function RewardScanStream({
  scanToken,
  collected,
}: {
  scanToken: string
  collected: boolean
}) {
  const context = await loadMerchantRewardScanContext(scanToken)

  if (context.status === "unauthenticated") {
    redirect(`/login?next=/app/rewards/scan/${scanToken}`)
  }

  if (context.status === "not_found") {
    notFound()
  }

  if (context.status === "unauthorized") {
    return (
      <StatusBanner title="Reward not matched" tone="warning">
        This reward belongs to another venue.
      </StatusBanner>
    )
  }

  if (!("rewardId" in context)) {
    notFound()
  }

  return (
    <>
      <RewardTicket
        state={
          context.status === "redeemed" || collected ? "redeemed" : "ready"
        }
        name={context.rewardName}
        description={
          <>
            {context.rewardTerms}
            {context.minSpendPence !== null ? (
              <> Minimum spend {formatPence(context.minSpendPence)}.</>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 rounded-xl border-2 border-ink bg-card p-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="font-bold text-muted-foreground">Customer</span>
          <span className="text-right font-bold">{context.customerLabel}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-bold text-muted-foreground">Card</span>
          <span className="text-right font-mono text-xs font-bold uppercase">
            {context.membershipId.slice(0, 8)}
          </span>
        </div>
      </div>

      {context.status === "redeemed" || collected ? (
        <StatusBanner title="Reward collected" tone="success">
          This reward is now closed. The customer can scan the venue QR again
          when they are ready for their next stamp.
        </StatusBanner>
      ) : context.status === "blocked" ? (
        <StatusBanner title="Cannot collect this reward" tone="warning">
          {context.blockedReason ?? "This reward is not ready to collect."}
        </StatusBanner>
      ) : (
        <>
          <StatusBanner title="Ready to collect" tone="success">
            Check the reward against the order. Mark it collected when you have
            served it.
          </StatusBanner>
          <MerchantRewardCollectionForm scanToken={context.scanToken} />
        </>
      )}

      <Button asChild variant="secondary">
        <Link href="/app/activity">Back to activity</Link>
      </Button>
    </>
  )
}

function ScanShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageTitle
        eyebrow="Reward collection"
        title="Check and collect reward"
        description="Confirm the customer is at the counter before marking the reward collected."
      />
      <section className="grid gap-4">{children}</section>
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}
