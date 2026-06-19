import { Activity03Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"
import { MERCHANT_ACTIVITY_FEED } from "./mock-data"

/**
 * Mirror of `/app/activity`. Reuses the real `ActivityDetailFeed` (a client
 * component) with mock `ActivityDisplayRow[]` so the filter/search chrome and
 * grouped feed render exactly as in production.
 *
 * `empty` swaps the rows to `[]` so `ActivityDetailFeed` renders the route's
 * real `EmptyState` instead of the filter chrome — the empty-state preview.
 */
export function MerchantActivityScreen({ empty = false }: { empty?: boolean }) {
  const rows = empty ? [] : MERCHANT_ACTIVITY_FEED

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Activity"
        description="Everything happening on your loyalty card: joins, stamps, rewards, and QR downloads."
      />

      <ActivityDetailFeed
        rows={rows}
        totalCount={rows.length}
        loadedCount={rows.length}
        limit={25}
        initialFilter="all"
        initialQuery=""
        emptyState={
          <EmptyState
            title="No activity yet"
            description="Activity will appear after customers join, add stamps, redeem rewards, or download QR assets."
            icon={Activity03Icon}
          />
        }
      />
    </div>
  )
}
