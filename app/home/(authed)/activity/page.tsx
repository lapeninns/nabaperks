import { Activity03Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityRow } from "@/components/customer/activity-row"
import {
  CustomerActivityFeed,
  type ActivityFeedEntry,
} from "@/components/customer/activity-feed"
import { getCustomerActivity } from "@/lib/customer/activity"
import { formatDate } from "@/lib/customer/format"
import { formatLondonIso } from "@/lib/customer/uk-calendar"

export const metadata = {
  title: "Your activity · Nabaperks",
}

export default async function HomeActivityPage() {
  const items = await getCustomerActivity()

  // Rows are rendered HERE, on the server, and handed to the client feed as
  // nodes. `ActivityRow` prints a relative timestamp, so re-rendering it in the
  // client would risk a hydration mismatch on every row; grouping and filtering
  // only need the plain fields beside it (CUS 02#43).
  const entries: ActivityFeedEntry[] = items.map((item) => ({
    id: item.id,
    category: item.category,
    dayKey: formatLondonIso(new Date(item.createdAt)),
    dayLabel: formatDate(item.createdAt),
    row: <ActivityRow key={item.id} item={item} />,
  }))

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Activity"
        description="Every stamp and reward across your cards, newest first."
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Your stamps and rewards will appear here once you start visiting venues."
          icon={Activity03Icon}
        />
      ) : (
        <CustomerActivityFeed entries={entries} />
      )}
    </div>
  )
}
