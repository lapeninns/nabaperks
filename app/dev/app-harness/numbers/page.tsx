import { notFound } from "next/navigation"

import { NumbersOverviewSkeleton } from "@/components/merchant/loading-skeletons"
import { NumbersOverview } from "@/components/merchant/numbers-overview"
import { StreamErrorCard } from "@/components/merchant/stream-error-boundary"
import { parseNumbersRange } from "@/lib/merchant/numbers-nav"
import { buildNumbersOverviewModel } from "@/lib/merchant/numbers-overview-model"

import {
  HARNESS_NOW_ISO,
  HARNESS_NUMBERS_SERIES,
  HARNESS_NUMBERS_TOTALS,
  HARNESS_NUMBERS_TRENDS,
  HARNESS_NUMBERS_ZERO_SERIES,
} from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** First-stamp instants that place the fixture venue in each band. */
const FIRST_STAMP = {
  full: "2026-08-01T10:00:00.000Z",
  partial: "2026-09-15T09:00:00.000Z",
  early: "2026-09-20T09:00:00.000Z",
  never: null,
} as const

type NumbersHarnessParams = {
  /** full (default) · partial · early · never · zero · series-error ·
   *  totals-error · both-error · loading */
  state?: string
  range?: string
}

/**
 * Numbers harness — mounts the REAL {@link NumbersOverview} from the pure
 * model builder with literal fixtures, one state per query, so every row of
 * handoff §7.4 is screenshot- and axe-provable without a login. The series
 * reproduces the reference deltas: new members 25 (same), stamps 51 (8
 * fewer), rewards 3 (7 fewer), members 81.
 */
export default async function NumbersHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<NumbersHarnessParams>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const state = params.state ?? "full"
  const range = parseNumbersRange(params.range)
  const basePath = "/dev/app-harness/numbers"

  if (state === "loading") {
    return (
      <>
        <h1 className="sr-only">Numbers</h1>
        <NumbersOverviewSkeleton />
      </>
    )
  }

  if (state === "both-error") {
    return (
      <>
        <h1 className="sr-only">Numbers</h1>
        <StreamErrorCard label="your numbers" onRetry={noopRetry} />
      </>
    )
  }

  const firstStampAt =
    state === "partial"
      ? FIRST_STAMP.partial
      : state === "early"
        ? FIRST_STAMP.early
        : state === "never"
          ? FIRST_STAMP.never
          : FIRST_STAMP.full
  const totalsFailed = state === "totals-error"
  const seriesFailed = state === "series-error"

  const model = buildNumbersOverviewModel({
    range,
    totals: totalsFailed ? null : HARNESS_NUMBERS_TOTALS,
    trends: totalsFailed ? null : HARNESS_NUMBERS_TRENDS,
    series: seriesFailed
      ? null
      : state === "zero"
        ? HARNESS_NUMBERS_ZERO_SERIES
        : HARNESS_NUMBERS_SERIES,
    firstStampAt,
    now: new Date(HARNESS_NOW_ISO),
  })

  return (
    <>
      <h1 className="sr-only">Numbers</h1>
      <NumbersOverview
        model={model}
        basePath={`${basePath}${state === "full" ? "" : `?state=${state}&`}`.replace(
          /&$/,
          ""
        )}
      />
    </>
  )
}

async function noopRetry() {
  "use server"
}
