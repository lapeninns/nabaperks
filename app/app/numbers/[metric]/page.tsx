import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { NumbersDetailSkeleton } from "@/components/merchant/loading-skeletons"
import { NumbersDetail } from "@/components/merchant/numbers-detail"
import { StreamErrorBoundary } from "@/components/merchant/stream-error-boundary"
import { getCurrentMerchant } from "@/lib/auth/session"
import { getEnrichedMerchantActivity } from "@/lib/merchant/activity"
import {
  getMerchantDashboardData,
  getMerchantDashboardSeries,
  type MerchantDashboardMerchant,
} from "@/lib/merchant/dashboard"
import { buildNumbersDetailModel } from "@/lib/merchant/numbers-detail-model"
import { getFirstStampAt } from "@/lib/merchant/numbers-first-stamp"
import {
  isNumbersMetric,
  parseNumbersRange,
  type NumbersMetric,
  type NumbersRange,
} from "@/lib/merchant/numbers-nav"
import { timeServerLoader } from "@/lib/perf/server-timing"

export const dynamic = "force-dynamic"

/**
 * /app/numbers/[metric] — one metric's detail (handoff §6.3.2). The segment
 * is validated against the literal metric list; anything else is a 404.
 */
export default async function MerchantNumbersDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>
  searchParams?: Promise<{ range?: string | string[] }>
}) {
  const { metric } = await params
  if (!isNumbersMetric(metric)) {
    notFound()
  }

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
      <StreamErrorBoundary label="this metric">
        <Suspense
          key={`${metric}:${range}`}
          fallback={<NumbersDetailSkeleton />}
        >
          <NumbersDetailStream
            merchant={merchant}
            metric={metric}
            range={range}
          />
        </Suspense>
      </StreamErrorBoundary>
    </>
  )
}

async function NumbersDetailStream({
  merchant,
  metric,
  range,
}: {
  merchant: MerchantDashboardMerchant
  metric: NumbersMetric
  range: NumbersRange
}) {
  const category = (
    {
      members: "customer",
      stamps: "stamp",
      rewards: "reward",
      qr: "qr",
    } as const
  )[metric]
  const [dashboard, series, firstStamp, recent] = await Promise.allSettled([
    timeServerLoader("/app/numbers/[metric]", "getMerchantDashboardData", () =>
      getMerchantDashboardData(merchant)
    ),
    timeServerLoader(
      "/app/numbers/[metric]",
      "getMerchantDashboardSeries",
      () => getMerchantDashboardSeries(merchant.id)
    ),
    timeServerLoader("/app/numbers/[metric]", "getFirstStampAt", () =>
      getFirstStampAt(merchant.id)
    ),
    timeServerLoader(
      "/app/numbers/[metric]",
      "getEnrichedMerchantActivity",
      () =>
        // Stamp pairs thread into one card; fetch a margin and slice to five.
        getEnrichedMerchantActivity(merchant.id, {
          limit: 12,
          filter: category,
        })
    ),
  ])

  if (dashboard.status === "rejected" && series.status === "rejected") {
    throw dashboard.reason
  }

  const totals =
    dashboard.status === "fulfilled" ? dashboard.value.metrics : null
  const model = buildNumbersDetailModel({
    metric,
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

  return (
    <NumbersDetail
      model={model}
      recentRows={
        recent.status === "fulfilled" ? recent.value.rows.slice(0, 5) : null
      }
    />
  )
}
