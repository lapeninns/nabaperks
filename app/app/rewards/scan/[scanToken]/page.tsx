import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { PageTitle } from "@/components/brand"
import { CelebrationUrlCleanup } from "@/components/customer/celebration-url-cleanup"
import { RewardScanContentSkeleton } from "@/components/merchant/loading-skeletons"
import { MerchantRewardCollectionForm } from "@/components/merchant/reward-collection-form"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { loadMerchantRewardScanContext } from "@/lib/merchant/reward-collection"
import { merchantLoginHref } from "@/lib/navigation/safe-next-path"

// Scan tokens are uuid-typed in the RPC; reject malformed input early rather
// than taking the noisy throw → error-boundary path. Mirrors /r/[token].
const SCAN_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type MerchantRewardScanPageProps = {
  params: Promise<{
    scanToken: string
  }>
  searchParams?: Promise<{
    collected?: string | string[]
  }>
}

export default async function MerchantRewardScanPage({
  params,
  searchParams,
}: MerchantRewardScanPageProps) {
  const { scanToken } = await params

  if (!SCAN_TOKEN_PATTERN.test(scanToken)) {
    notFound()
  }

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
    redirect(
      merchantLoginHref(`/app/rewards/scan/${encodeURIComponent(scanToken)}`)
    )
  }

  if (context.status === "not_found") {
    notFound()
  }

  if (context.status === "expired") {
    return (
      <StatusBanner title="Reward expired" tone="warning">
        This reward expired — ask the customer to re-scan the venue QR for a
        fresh code.
      </StatusBanner>
    )
  }

  if (context.status === "unauthorized") {
    return (
      <StatusBanner title="Reward not matched" tone="warning">
        This reward belongs to another venue.
      </StatusBanner>
    )
  }

  // Every reward-bearing status (ready | redeemed | blocked) carries the reward
  // fields rendered below. Narrow the union to that member and fall back to the
  // in-shell 404 for any unrecognised status (defensive — unreachable via the
  // status checks above, but it keeps the render type-safe).
  if (!("rewardName" in context)) {
    notFound()
  }

  // Server state is authoritative: only a redeemed reward shows the collected
  // ticket/banner. ?collected=1 merely upgrades copy on the fresh post-collect
  // render — it never stands in for server state on a bookmark/bfcache replay.
  const isRedeemed = context.status === "redeemed"

  return (
    <>
      {isRedeemed && collected ? <CelebrationUrlCleanup /> : null}
      <RewardTicket
        state={isRedeemed ? "redeemed" : "ready"}
        name={context.rewardName}
        description={context.rewardTerms}
        sealSlammed={isRedeemed && collected}
      />

      <h2 className="sr-only">Member and card details</h2>
      <dl className="grid gap-2 rounded-xl border-2 border-ink bg-card p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-muted-foreground">Member</dt>
          <dd className="text-right font-bold">{context.customerLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-bold text-muted-foreground">Card</dt>
          <dd className="text-right font-mono text-xs font-bold uppercase">
            {context.membershipId.slice(0, 8)}
          </dd>
        </div>
      </dl>

      {isRedeemed ? (
        <StatusBanner title="Reward collected" tone="success">
          {collected ? "Reward marked collected. " : null}
          This reward is now closed. The member can scan the venue QR again when
          they are ready for their next stamp.
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

      {/* Post-collection the natural next task at a busy counter is the NEXT
          member — lead with "Scan another" once this reward is closed. */}
      {isRedeemed ? (
        <Button asChild>
          <Link href="/app/scan">Scan another reward</Link>
        </Button>
      ) : null}
      <Button asChild variant="secondary">
        <Link href="/app">Back to dashboard</Link>
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
        description="Confirm the member is at the counter before marking the reward collected."
      />
      <section className="grid gap-4">{children}</section>
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
