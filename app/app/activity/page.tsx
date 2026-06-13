import { redirect } from "next/navigation"
import { Suspense } from "react"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
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
  const activity = await getEnrichedMerchantActivity(merchant.id, { limit })

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Activity log"
        description="Recent operational events."
      />

      <Suspense fallback={null}>
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
              description="Activity will appear after customers join, staff issue stamps, rewards are redeemed, or QR assets are downloaded."
            />
          }
        />
      </Suspense>
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
