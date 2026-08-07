import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Activity03Icon, QrCode01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, Icon, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { ActivityFeedSkeleton } from "@/components/merchant/loading-skeletons"
import { Button } from "@/components/ui/button"
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

/**
 * Hard ceiling on the grown window. `parseActivityLimit` clamps to it, so a
 * "Load more" press at the ceiling used to re-render the same rows and read as
 * a bug — the feed now names the wall instead of offering the control (03#52).
 */
const ACTIVITY_LIMIT_CEILING = 250
const ACTIVITY_LIMIT_DEFAULT = 25

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

      {/* Re-key the streamed feed on the filter pill only, so its client
          filter/search state re-initializes on a real filter nav. `limit` is
          deliberately NOT in the key: "Load more" must extend the list in
          place (rows arrive via props during the Link transition) instead of
          unmounting everything the merchant has read into a skeleton. `q` is
          also excluded: it refetches via props but must not remount the live
          search box on every keystroke. */}
      <Suspense key={filter} fallback={<ActivityFeedSkeleton />}>
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
      atCeiling={activity.limit >= ACTIVITY_LIMIT_CEILING}
      ceiling={ACTIVITY_LIMIT_CEILING}
      initialFilter={filter}
      initialQuery={searchQuery}
      emptyState={
        <EmptyState
          title="No activity yet"
          description="Activity will appear after members join, add stamps, redeem rewards, or download QR assets."
          icon={Activity03Icon}
          actions={
            <Button asChild>
              <Link href="/app/qr" prefetch={false}>
                <Icon icon={QrCode01Icon} size={16} />
                Open your Poster kit
              </Link>
            </Button>
          }
        />
      }
    />
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseActivityLimit(value: string | undefined) {
  if (!value) return ACTIVITY_LIMIT_DEFAULT

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return ACTIVITY_LIMIT_DEFAULT
  return Math.min(Math.max(Math.floor(parsed), 1), ACTIVITY_LIMIT_CEILING)
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
