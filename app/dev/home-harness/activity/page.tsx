import { notFound } from "next/navigation"

import { ActivityRow } from "@/components/customer/activity-row"
import {
  CustomerActivityFeed,
  type ActivityFeedEntry,
} from "@/components/customer/activity-feed"
import { shapeCustomerActivityItem } from "@/lib/customer/activity-core"
import { formatDate } from "@/lib/customer/format"
import { formatLondonIso } from "@/lib/customer/uk-calendar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * `/home/activity` (CUS 02#43), which is auth-gated and needs a member with a
 * real event history, so the finding's numbers — "40 rows, ~142px each,
 * ~5,800px of scrolling" — could never be checked on the shipped page.
 *
 * Mounts the REAL {@link CustomerActivityFeed} over the REAL
 * {@link ActivityRow}, with rows shaped by the REAL
 * `shapeCustomerActivityItem`, so no production markup is restated here. Only
 * the loader is replaced: this is the same 40-item default the page asks for,
 * spread over ten London days across the three categories the loader
 * classifies.
 */
const HARNESS_EVENTS = [
  "stamp_issued",
  "stamp_issued",
  "reward_unlocked",
  "stamp_issued",
  "reward_redeemed",
  "customer_joined",
] as const

const VENUES = ["Old Crown Girton", "The Panton Arms", "Hot Numbers"]

/** Ten London days of history, forty entries — the loader's DEFAULT_LIMIT. */
function harnessEntries(): ActivityFeedEntry[] {
  const entries: ActivityFeedEntry[] = []

  for (let index = 0; index < 40; index += 1) {
    const eventName = HARNESS_EVENTS[index % HARNESS_EVENTS.length]
    // Four entries a day, ten days back, at a fixed hour so the harness is
    // stable across runs.
    const day = Math.floor(index / 4)
    const createdAt = new Date(
      Date.UTC(2026, 6, 20 - day, 18 - (index % 4), 30)
    ).toISOString()

    const item = shapeCustomerActivityItem({
      id: `harness-${index}`,
      eventName,
      category:
        eventName === "customer_joined"
          ? "join"
          : eventName === "stamp_issued"
            ? "stamp"
            : "reward",
      metadata: {
        rewardName: "A free house drink",
        newStampCount: (index % 8) + 1,
      },
      businessName: VENUES[index % VENUES.length],
      createdAt,
    })

    entries.push({
      id: item.id,
      category: item.category,
      dayKey: formatLondonIso(new Date(item.createdAt)),
      dayLabel: formatDate(item.createdAt),
      row: <ActivityRow key={item.id} item={item} />,
    })
  }

  return entries
}

export default function ActivityHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <div className="grid gap-6" data-harness-activity>
      <CustomerActivityFeed entries={harnessEntries()} />
    </div>
  )
}
