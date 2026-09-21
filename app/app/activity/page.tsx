import { redirect } from "next/navigation"
import { Suspense } from "react"

import { ActivityControls } from "@/components/merchant/activity-controls"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { ActivityFeedSkeleton } from "@/components/merchant/loading-skeletons"
import { StreamErrorBoundary } from "@/components/merchant/stream-error-boundary"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  type ActivityCategory,
  getEnrichedMerchantActivity,
  getMerchantActivitySummary,
} from "@/lib/merchant/activity"
import {
  activityScopeSince,
  parseActivityScope,
  type ActivityScope,
} from "@/lib/merchant/activity-scope"
import { countRows } from "@/lib/merchant/dashboard-counts"

// cacheComponents is OFF for this repo, so the literal force-dynamic segment
// config is valid: this feed reflects per-request searchParams and live data
// and must never be statically cached.
export const dynamic = "force-dynamic"

type MerchantActivitySearchParams = {
  filter?: string | string[]
  q?: string | string[]
  limit?: string | string[]
  range?: string | string[]
}

/**
 * Activity — the owner's read of what happened (handoff §6.2). Scope and
 * category are server-side query params so "Load more" grows the scoped,
 * filtered set.
 */
export default async function MerchantActivityPage({
  searchParams,
}: {
  searchParams?: Promise<MerchantActivitySearchParams>
}) {
  const query = await searchParams
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const filter = normalizeActivityFilter(firstParam(query?.filter))
  const scope = parseActivityScope(firstParam(query?.range))
  const searchQuery = firstParam(query?.q) ?? ""
  const limit = parseActivityLimit(firstParam(query?.limit))

  return (
    <>
      <h1 className="sr-only">Activity</h1>
      {/* Scope and category are URL state and live outside the boundary, so
          a failing query never takes the controls with it. */}
      <div className="mx-auto mb-4 w-full max-w-[35rem] min-[900px]:max-w-[51.25rem]">
        <ActivityControls filter={filter} scope={scope} />
      </div>
      {/* Re-key the streamed feed on the filter and scope only, so its client
          state re-initializes on a real navigation. `limit` is deliberately
          NOT in the key: "Load more" must extend the list in place. `q` is
          also excluded: it refetches via props but must not remount the live
          search box on every keystroke. */}
      <StreamErrorBoundary label="your activity">
        <Suspense
          key={`${filter}:${scope}`}
          fallback={<ActivityFeedSkeleton />}
        >
          <ActivityFeedStream
            merchantId={merchant.id}
            filter={filter}
            scope={scope}
            searchQuery={searchQuery}
            limit={limit}
          />
        </Suspense>
      </StreamErrorBoundary>
    </>
  )
}

async function ActivityFeedStream({
  merchantId,
  filter,
  scope,
  searchQuery,
  limit,
}: {
  merchantId: string
  filter: "all" | ActivityCategory
  scope: ActivityScope
  searchQuery: string
  limit: number
}) {
  const [activity, summary, lifetime] = await Promise.all([
    getEnrichedMerchantActivity(merchantId, {
      limit,
      filter,
      since: activityScopeSince(scope, new Date()),
    }),
    getMerchantActivitySummary(merchantId),
    // Lifetime evidence for the empty copy; a failed count means "unknown".
    countRows("product_events", merchantId).then(
      (count) => count > 0,
      () => null
    ),
  ])

  return (
    <ActivityDetailFeed
      summary={summary}
      rows={activity.rows}
      limit={activity.limit}
      hasMore={activity.hasMore}
      initialFilter={filter}
      initialQuery={searchQuery}
      initialScope={scope}
      hasEverHadActivity={lifetime}
    />
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseActivityLimit(value: string | undefined) {
  if (!value) return 25

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 25
  return Math.min(Math.max(Math.floor(parsed), 1), 250)
}

function normalizeActivityFilter(
  value: string | undefined
): "all" | ActivityCategory {
  if (
    value === "customer" ||
    value === "stamp" ||
    value === "reward" ||
    value === "qr" ||
    value === "account"
  ) {
    return value
  }

  return "all"
}
