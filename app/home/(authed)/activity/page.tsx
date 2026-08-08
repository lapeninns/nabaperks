import { Activity03Icon } from "@hugeicons/core-free-icons"

import { EmptyState, PageTitle } from "@/components/brand"
import { ActivityRow } from "@/components/customer/activity-row"
import { ShowMoreList } from "@/components/data/show-more-list"
import {
  getCustomerActivity,
  type CustomerActivityItem,
} from "@/lib/customer/activity"
import { formatDate } from "@/lib/customer/format"
import { formatLondonIso } from "@/lib/customer/uk-calendar"

export const metadata = {
  title: "Your activity · Nabaperks",
}

type ActivityDay = {
  readonly key: string
  readonly label: string
  readonly items: readonly CustomerActivityItem[]
}

/**
 * Group the feed into London calendar days, newest first, preserving the order
 * the loader returned.
 *
 * The feed defaults to 40 entries and used to render as forty visually
 * identical shadowed cards with no date separators, no grouping and no
 * landmarks — roughly 5,800px of scrolling in which "when did I last visit the
 * Old Crown" required reading every row (CUS 02#43). Day headers are the
 * cheapest landmark that answers that question.
 */
function groupByLondonDay(
  items: readonly CustomerActivityItem[]
): readonly ActivityDay[] {
  const days: ActivityDay[] = []

  for (const item of items) {
    const key = formatLondonIso(new Date(item.createdAt))
    const last = days.at(-1)

    if (last?.key === key) {
      ;(last.items as CustomerActivityItem[]).push(item)
      continue
    }

    days.push({ key, label: formatDate(item.createdAt), items: [item] })
  }

  return days
}

export default async function HomeActivityPage() {
  const items = await getCustomerActivity()
  const days = groupByLondonDay(items)

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Activity"
        description="Every stamp and reward across your cards, newest first."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Your stamps and rewards will appear here once you start visiting venues."
          icon={Activity03Icon}
        />
      ) : (
        <ShowMoreList
          label="Activity by day"
          className="gap-5"
          listClassName="grid gap-5"
          // Five days, not five rows: the day grouping is the landmark this
          // finding added, and capping rows would cut a day in half. At roughly
          // 56px a row plus a 30px header that is about one phone screen of
          // recent activity, with the rest one press away. The server still
          // renders every day, so the page stays print- and crawl-complete
          // (CUS 02#43).
          initialCount={5}
          step={5}
          items={days.map((day) => ({
            key: day.key,
            content: (
              <section className="grid gap-1">
                {/* Sticky so the day you are reading stays named while you
                    scroll. `top` clears the app shell's sticky header. */}
                <h2 className="eyebrow sticky top-[4.25rem] z-10 -mx-1 bg-background px-1 py-1.5">
                  {day.label}
                </h2>
                <ol className="grid">
                  {day.items.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </ol>
              </section>
            ),
          }))}
        />
      )}
    </div>
  )
}
