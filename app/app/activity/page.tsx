import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Activity03Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { ActivityFeedSkeleton } from "@/components/merchant/loading-skeletons"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  type ActivityCategory,
  getEnrichedMerchantActivity,
  getMerchantActivitySummary,
} from "@/lib/merchant/activity"

// cacheComponents is OFF for this repo, so the literal force-dynamic segment
// config is valid: this feed reflects per-request searchParams and live data
// and must never be statically cached.
export const dynamic = "force-dynamic"

type MerchantActivitySearchParams = {
  filter?: string | string[]
  q?: string | string[]
  limit?: string | string[]
}

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
  const searchQuery = firstParam(query?.q) ?? ""
  const limit = parseActivityLimit(firstParam(query?.limit))

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Activity"
        description="Everything happening on your loyalty card: joins, stamps, rewards, and QR downloads."
      />

      {/* Re-key the streamed feed on the discrete nav params (filter pill and
          "Load more" limit) so its client filter/search state re-initializes
          from the new searchParams on soft nav. `q` is deliberately excluded:
          it refetches on the server via props but must not remount the live
          search box on every keystroke — a "Load more" still carries q in the
          URL, and the limit change here remounts and re-reads it. */}
      <Suspense
        key={`${filter}:${limit}`}
        fallback={<ActivityFeedSkeleton />}
      >
        <ActivityFeedStream
          merchantId={merchant.id}
          filter={filter}
          searchQuery={searchQuery}
          limit={limit}
        />
      </Suspense>
    </div>
  )
}

async function ActivityFeedStream({
  merchantId,
  filter,
  searchQuery,
  limit,
}: {
  merchantId: string
  filter: "all" | ActivityCategory
  searchQuery: string
  limit: number
}) {
  const [activity, summary] = await Promise.all([
    getEnrichedMerchantActivity(merchantId, {
      limit,
      filter,
    }),
    getMerchantActivitySummary(merchantId),
  ])

  return (
    <ActivityDetailFeed
      summary={summary}
      rows={activity.rows}
      limit={activity.limit}
      hasMore={activity.hasMore}
      initialFilter={filter}
      initialQuery={searchQuery}
      emptyState={
        <EmptyState
          title="No activity yet"
          description="Activity will appear after members join, add stamps, redeem rewards, or download QR assets."
          icon={Activity03Icon}
        />
      }
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
