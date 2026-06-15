import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Activity03Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentMerchant } from "@/lib/auth/session"
import {
  type ActivityCategory,
  getEnrichedMerchantActivity,
} from "@/lib/merchant/activity"

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
        description="Everything happening on your loyalty card — joins, stamps, rewards, and QR downloads."
      />

      <Suspense fallback={<ActivityFeedSkeleton />}>
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
  const activity = await getEnrichedMerchantActivity(merchantId, { limit })

  return (
    <ActivityDetailFeed
      rows={activity.rows}
      totalCount={activity.totalCount}
      loadedCount={activity.loadedCount}
      limit={activity.limit}
      initialFilter={filter}
      initialQuery={searchQuery}
      emptyState={
        <EmptyState
          title="No activity yet"
          description="Activity will appear after customers join, add stamps, redeem rewards, or download QR assets."
          icon={Activity03Icon}
        />
      }
    />
  )
}

function ActivityFeedSkeleton() {
  return (
    <div className="grid min-h-[360px] gap-4" aria-label="Loading activity">
      <section className="grid gap-3 rounded-[8px] border-2 border-ink/20 bg-card/70 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Skeleton className="h-11 rounded-[8px]" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((option) => (
              <Skeleton key={option} className="h-9 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-3 w-24 rounded-full bg-muted-foreground/20" />
      </section>

      <div className="grid gap-6">
        {[0, 1].map((group) => (
          <section key={group} className="grid gap-2">
            <Skeleton className="h-3 w-28 rounded-full bg-ink/15" />
            <ol className="grid gap-2">
              {[0, 1, 2].map((row) => (
                <li key={row} className="grid grid-cols-[auto_1fr] gap-3">
                  <Skeleton className="mt-4 size-2.5 rounded-full bg-ink/25" />
                  <Skeleton className="h-[74px] rounded-[8px] border-2 border-ink/15 bg-card/70" />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
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
