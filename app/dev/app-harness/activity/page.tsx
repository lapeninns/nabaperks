import { notFound } from "next/navigation"
import { Activity03Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityDetailFeed } from "@/components/merchant/activity-detail-feed"

import { HARNESS_ACTIVITY_ROWS, HARNESS_ACTIVITY_SUMMARY } from "../fixtures"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Activity harness — mounts the REAL {@link ActivityDetailFeed} (the client body
 * the /app/activity stream renders) with DB-free fixture rows + a "this week"
 * summary, inside the same PageTitle the real route uses. Exercises the
 * StatStrip, search box, FilterPills, the date-grouped timeline cards, and the
 * "events loaded" footer.
 */
export default function ActivityHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Activity"
        title="Activity"
        description="Everything happening on your loyalty card: joins, stamps, rewards, and QR downloads."
      />

      <ActivityDetailFeed
        summary={HARNESS_ACTIVITY_SUMMARY}
        rows={HARNESS_ACTIVITY_ROWS}
        limit={25}
        hasMore={false}
        initialFilter="all"
        initialQuery=""
        emptyState={
          <EmptyState
            title="No activity yet"
            description="Activity will appear after members join, add stamps, redeem rewards, or download QR assets."
            icon={Activity03Icon}
          />
        }
      />
    </div>
  )
}
