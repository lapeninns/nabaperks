import Link from "next/link"
import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { MerchantRewardCollectionForm } from "@/components/merchant/reward-collection-form"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// UUID-shaped so it mirrors a real scan token (the form posts it as a hidden
// field; the action never fires from a screenshot).
const HARNESS_SCAN_TOKEN = "00000000-0000-4000-8000-000000000000"

/**
 * Reward-scan harness — variant "full". Reproduces the REAL deep-link page's
 * ScanShell layout (app/app/rewards/scan/[rewardId]/page.tsx) and mounts the
 * REAL presentational body: {@link RewardTicket}, {@link StatusBanner}, and the
 * REAL {@link MerchantRewardCollectionForm}, fed a DB-free reward fixture (the
 * async RewardScanStream self-fetches via loadMerchantRewardScanContext, so its
 * presentational children are mounted directly — no re-created markup).
 *
 * Covers BOTH states the real route renders via the same `?collected=` query:
 *   - default (pending): ticket state="ready" + "Ready to collect" banner +
 *     the collection form.
 *   - ?collected=1       : ticket state="redeemed" + "Reward collected" banner,
 *     mirroring the post-collect / server-redeemed render.
 */
export default async function RewardScanHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ collected?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const collected = params.collected === "1"

  const rewardName = "Free hot drink"
  const rewardTerms = "On the house, redeemable from the next UK business day."

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <PageTitle
        eyebrow="Reward collection"
        title="Check and collect reward"
        description="Confirm the member is at the counter before marking the reward collected."
      />
      <section className="grid gap-4">
        <RewardTicket
          state={collected ? "redeemed" : "ready"}
          name={rewardName}
          description={rewardTerms}
        />

        <h2 className="sr-only">Member and card details</h2>
        <dl className="grid gap-2 rounded-xl border-2 border-ink bg-card p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="font-bold text-muted-foreground">Member</dt>
            <dd className="text-right font-bold">Phone ending 421</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-bold text-muted-foreground">Card</dt>
            <dd className="text-right font-mono text-xs font-bold uppercase">
              mbr_0f3a
            </dd>
          </div>
        </dl>

        {collected ? (
          <StatusBanner title="Reward collected" tone="success">
            Reward marked collected. This reward is now closed. The member can
            scan the venue QR again when they are ready for their next stamp.
          </StatusBanner>
        ) : (
          <>
            <StatusBanner title="Ready to collect" tone="success">
              Check the reward against the order. Mark it collected when you have
              served it.
            </StatusBanner>
            <MerchantRewardCollectionForm scanToken={HARNESS_SCAN_TOKEN} />
          </>
        )}

        <Button asChild variant="secondary">
          <Link href="/app">Back to dashboard</Link>
        </Button>
      </section>
    </div>
  )
}
