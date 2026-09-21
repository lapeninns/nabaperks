import { notFound } from "next/navigation"

import { NumbersDetail } from "@/components/merchant/numbers-detail"
import { buildNumbersDetailModel } from "@/lib/merchant/numbers-detail-model"
import { isNumbersMetric, parseNumbersRange } from "@/lib/merchant/numbers-nav"

import {
  HARNESS_ACTIVITY_ROWS,
  HARNESS_NOW_ISO,
  HARNESS_NUMBERS_REWARDS,
  HARNESS_NUMBERS_SERIES,
  HARNESS_NUMBERS_TOTALS,
  HARNESS_NUMBERS_TRENDS,
} from "../../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIRST_STAMP = {
  full: "2026-08-01T10:00:00.000Z",
  partial: "2026-09-15T09:00:00.000Z",
  early: "2026-09-20T09:00:00.000Z",
} as const

/**
 * Metric detail harness — the REAL {@link NumbersDetail} for each of the
 * four metrics from the pure model builder, with `?state=full|partial|early|
 * series-error|recent-error` and `?range=`. An unknown metric 404s exactly
 * as the production route does.
 */
export default async function NumbersDetailHarnessPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>
  searchParams?: Promise<{ state?: string; range?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const { metric } = await params
  if (!isNumbersMetric(metric)) {
    notFound()
  }

  const query = searchParams ? await searchParams : {}
  const state = query.state ?? "full"
  const range = parseNumbersRange(query.range)
  const category = (
    {
      members: "customer",
      stamps: "stamp",
      rewards: "reward",
      qr: "qr",
    } as const
  )[metric]

  const model = buildNumbersDetailModel({
    metric,
    range,
    totals: HARNESS_NUMBERS_TOTALS,
    trends: HARNESS_NUMBERS_TRENDS,
    series:
      state === "series-error"
        ? null
        : { ...HARNESS_NUMBERS_SERIES, rewards: HARNESS_NUMBERS_REWARDS },
    firstStampAt:
      state === "partial"
        ? FIRST_STAMP.partial
        : state === "early"
          ? FIRST_STAMP.early
          : FIRST_STAMP.full,
    now: new Date(HARNESS_NOW_ISO),
  })

  return (
    <>
      <h1 className="sr-only">Numbers</h1>
      <NumbersDetail
        model={model}
        recentRows={
          state === "recent-error"
            ? null
            : HARNESS_ACTIVITY_ROWS.filter(
                (row) => row.category === category
              ).slice(0, 5)
        }
        basePath="/dev/app-harness/numbers"
        activityHref="/dev/app-harness/activity"
      />
    </>
  )
}
