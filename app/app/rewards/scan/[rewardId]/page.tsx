import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { PageTitle } from "@/components/brand"
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
  const query = searchParams ? await searchParams : {}
  const context = await loadMerchantRewardScanContext(rewardId)

  if (context.status === "unauthenticated") {
    redirect(`/login?next=/app/rewards/scan/${rewardId}`)
  }

  if (context.status === "not_found") {
    notFound()
  }

  if (context.status === "unauthorized") {
    return (
      <ScanShell>
        <StatusBanner title="Reward not matched" tone="warning">
          This reward belongs to a different merchant account.
        </StatusBanner>
      </ScanShell>
    )
  }

  if (!("rewardId" in context)) {
    notFound()
  }

  const collected = firstParam(query.collected) === "1"

  return (
    <ScanShell>
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
          The reward has been marked as collected and the customer&apos;s next
          stamp cycle is open.
        </StatusBanner>
      ) : context.status === "blocked" ? (
        <StatusBanner title="Reward cannot be collected" tone="warning">
          {context.blockedReason ?? "This reward is not ready to collect."}
        </StatusBanner>
      ) : (
        <>
          <StatusBanner title="Customer reward ready" tone="success">
            Check the order, then collect the reward from this merchant device.
          </StatusBanner>
          <MerchantRewardCollectionForm rewardId={context.rewardId} />
        </>
      )}

      <Button asChild variant="secondary">
        <Link href="/app/activity">Back to activity</Link>
      </Button>
    </ScanShell>
  )
}

function ScanShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageTitle
        eyebrow="Reward scan"
        title="Collect customer reward"
        description="Use this screen after scanning the QR from the customer's phone."
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
