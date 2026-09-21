import { redirect } from "next/navigation"
import { Suspense } from "react"

import { NumbersOverviewSkeleton } from "@/components/merchant/loading-skeletons"
import { NumbersOverview } from "@/components/merchant/numbers-overview"
import { StreamErrorBoundary } from "@/components/merchant/stream-error-boundary"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  getMerchantDashboardData,
  getMerchantDashboardSeries,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { getFirstStampAt } from "@/lib/merchant/numbers-first-stamp"
import {
  parseNumbersRange,
  type NumbersRange,
} from "@/lib/merchant/numbers-nav"
import { buildNumbersOverviewModel } from "@/lib/merchant/numbers-overview-model"
import { timeServerLoader } from "@/lib/perf/server-timing"

export const dynamic = "force-dynamic"

type NumbersSearchParams = { range?: string | string[] }

/**
 * Numbers — the owner's after-service read (handoff §6.3.1). The range is
 * read server-side from `?range=` and keys the Suspense boundary, so a
 * range change shows the skeleton rather than old data at a new scale.
 */
export default async function MerchantNumbersPage({
  searchParams,
}: {
  searchParams?: Promise<NumbersSearchParams>
}) {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const query = await searchParams
  const rangeParam = Array.isArray(query?.range) ? query.range[0] : query?.range
  const range = parseNumbersRange(rangeParam)

  return (
    <>
      <h1 className="sr-only">Numbers</h1>
      <StreamErrorBoundary label="your numbers">
        <Suspense key={range} fallback={<NumbersOverviewSkeleton />}>
          <NumbersOverviewStream merchant={merchant} range={range} />
        </Suspense>
      </StreamErrorBoundary>
    </>
  )
}

async function NumbersOverviewStream({
  merchant,
  range,
}: {
  merchant: MerchantDashboardMerchant
  range: NumbersRange
}) {
  // The three reads settle independently: a failed series still shows the
  // totals and deltas, a failed totals read still shows the charts. Only
  // when every read fails does the boundary take over.
  const [dashboard, series, firstStamp] = await Promise.allSettled([
    timeServerLoader("/app/numbers", "getMerchantDashboardData", () =>
      getMerchantDashboardData(merchant)
    ),
    timeServerLoader("/app/numbers", "getMerchantDashboardSeries", () =>
      getMerchantDashboardSeries(merchant.id)
    ),
    timeServerLoader("/app/numbers", "getFirstStampAt", () =>
      getFirstStampAt(merchant.id)
    ),
  ])

  if (dashboard.status === "rejected" && series.status === "rejected") {
    throw dashboard.reason
  }
  // A failed first-stamp read is not "never stamped": without the clock the
  // bands cannot be chosen honestly, so the boundary takes over with Retry.
  if (firstStamp.status === "rejected") {
    throw firstStamp.reason
  }

  const totals =
    dashboard.status === "fulfilled" ? dashboard.value.metrics : null
  const model = buildNumbersOverviewModel({
    range,
    totals: totals
      ? {
          members: totals.members,
          stampsIssued: totals.stampsIssued,
          rewardsRedeemed: totals.rewardsRedeemed,
          qrDownloads: totals.qrDownloads,
        }
      : null,
    trends: dashboard.status === "fulfilled" ? dashboard.value.trends : null,
    series: series.status === "fulfilled" ? series.value : null,
    firstStampAt: firstStamp.status === "fulfilled" ? firstStamp.value : null,
    now: new Date(),
  })

  return <NumbersOverview model={model} />
}
