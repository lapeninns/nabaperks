import { notFound } from "next/navigation"

import { ActivityControls } from "@/components/merchant/activity-controls"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { parseActivityScope } from "@/lib/merchant/activity-scope"

import {
  HARNESS_ACTIVITY_GROUPED_ROWS,
  HARNESS_ACTIVITY_ROWS,
  HARNESS_ACTIVITY_SUMMARY,
} from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ActivityHarnessParams = {
  /** default · grouped · single · empty · load-more */
  fixture?: string
  filter?: string
  range?: string
  limit?: string
  /** `0` marks a venue that has never had an event. */
  lifetime?: string
}

/**
 * Activity harness — mounts the REAL {@link ActivityDetailFeed} with DB-free
 * fixture rows. `?fixture=grouped` supplies runs of QR scans and joins that
 * collapse into `<details>` groups; `single` mounts one row (no grouping, no
 * pills); `empty` with `?filter=` / `?range=` reaches each empty state;
 * `load-more` sets `hasMore`. The category and range are echoed from the
 * query so the feed's URL round-trips behave as in production.
 */
export default async function ActivityHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<ActivityHarnessParams>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const fixture = params.fixture ?? "default"
  const filter = normalizeFilter(params.filter)
  const scope = parseActivityScope(params.range)
  const rows =
    fixture === "grouped"
      ? HARNESS_ACTIVITY_GROUPED_ROWS
      : fixture === "single"
        ? HARNESS_ACTIVITY_ROWS.slice(0, 1)
        : fixture === "empty"
          ? []
          : HARNESS_ACTIVITY_ROWS
  const scopedRows =
    filter === "all" ? rows : rows.filter((row) => row.category === filter)
  const limit = Number(params.limit) > 0 ? Number(params.limit) : 25

  return (
    <>
      <h1 className="sr-only">Activity</h1>
      <div className="mb-4">
        <ActivityControls filter={filter} scope={scope} />
      </div>
      <ActivityDetailFeed
        summary={HARNESS_ACTIVITY_SUMMARY}
        rows={scopedRows}
        limit={limit}
        hasMore={fixture === "load-more" && limit < 50}
        initialFilter={filter}
        initialQuery=""
        initialScope={scope}
        posterHref="/dev/app-harness/qr"
        hasEverHadActivity={params.lifetime === "0" ? false : true}
      />
    </>
  )
}

function normalizeFilter(value: string | undefined) {
  switch (value) {
    case "customer":
    case "stamp":
    case "reward":
    case "qr":
    case "account":
      return value
    default:
      return "all" as const
  }
}
