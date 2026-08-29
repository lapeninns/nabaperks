"use client"

import { useMemo, useState, type ReactNode } from "react"

import { FilterPills } from "@/components/brand"
import { ShowMoreList } from "@/components/data/show-more-list"
import type { CustomerActivityCategory } from "@/lib/customer/activity-core"

/**
 * One entry, already rendered by the server.
 *
 * The row markup is handed over as a `ReactNode` rather than re-rendered here,
 * which is the pattern `ShowMoreList` already documents. It matters more than
 * usual on this screen: `ActivityRow` prints a RELATIVE timestamp, so rendering
 * it inside a client component would compute "2 hours ago" once during SSR and
 * again on hydration, and any tick between the two is a hydration mismatch on
 * every row. Serialised, the server's answer is the only answer.
 */
export type ActivityFeedEntry = {
  readonly id: string
  readonly category: CustomerActivityCategory
  /** London calendar day, used only for grouping. */
  readonly dayKey: string
  readonly dayLabel: string
  readonly row: ReactNode
}

const ALL_FILTER = "all"

/**
 * Plural, member-facing names for the three categories the loader already
 * distinguishes (`lib/customer/activity-core.ts`), in the order the audit asked
 * for: Stamps · Rewards · Joins.
 */
const CATEGORY_LABEL: Record<CustomerActivityCategory, string> = {
  stamp: "Stamps",
  reward: "Rewards",
  join: "Joins",
}

const CATEGORY_ORDER: readonly CustomerActivityCategory[] = [
  "stamp",
  "reward",
  "join",
]

type ActivityDay = {
  readonly key: string
  readonly label: string
  readonly entries: readonly ActivityFeedEntry[]
}

/**
 * Group a feed into London calendar days, newest first, preserving the order
 * the loader returned. Filtering can empty a day entirely, so this runs after
 * the filter rather than on the full list.
 */
function groupByDay(
  entries: readonly ActivityFeedEntry[]
): readonly ActivityDay[] {
  const days: ActivityDay[] = []

  for (const entry of entries) {
    const last = days.at(-1)

    if (last?.key === entry.dayKey) {
      ;(last.entries as ActivityFeedEntry[]).push(entry)
      continue
    }

    days.push({ key: entry.dayKey, label: entry.dayLabel, entries: [entry] })
  }

  return days
}

/**
 * `/home/activity`, filtered and paged.
 *
 * The day headers and the ~56px rows landed first; what was left of CUS 02#43
 * was the filter, and it was recorded open as "a question about how members
 * search their history". It is not: the loader has classified every event into
 * `join | stamp | reward` since it was written, and the audit named those three
 * as the pills. Nothing is being invented here — this exposes a taxonomy the
 * data already carries.
 *
 * A pill only appears for a category the member actually has, and the whole row
 * is suppressed below two categories: one pill and an "All" that selects the
 * same rows is a control that does nothing.
 */
export function CustomerActivityFeed({
  entries,
}: {
  readonly entries: readonly ActivityFeedEntry[]
}) {
  const [filter, setFilter] = useState<string>(ALL_FILTER)

  const counts = useMemo(() => {
    const tally = new Map<CustomerActivityCategory, number>()
    for (const entry of entries) {
      tally.set(entry.category, (tally.get(entry.category) ?? 0) + 1)
    }
    return tally
  }, [entries])

  const pills = useMemo(() => {
    const present = CATEGORY_ORDER.filter((category) => counts.has(category))
    if (present.length < 2) return []

    return [
      { id: ALL_FILTER, label: "All", count: entries.length },
      ...present.map((category) => ({
        id: category,
        label: CATEGORY_LABEL[category],
        count: counts.get(category) ?? 0,
      })),
    ]
  }, [counts, entries.length])

  const visible = useMemo(
    () =>
      filter === ALL_FILTER
        ? entries
        : entries.filter((entry) => entry.category === filter),
    [entries, filter]
  )

  const days = useMemo(() => groupByDay(visible), [visible])

  return (
    <div className="grid gap-4">
      {pills.length > 0 ? (
        <FilterPills
          aria-label="Filter activity"
          items={pills}
          value={filter}
          onValueChange={setFilter}
        />
      ) : null}

      <ShowMoreList
        // Remount on a filter change so the reveal starts from the top again;
        // otherwise switching to Rewards inherits however far the member had
        // expanded All.
        key={filter}
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
              <ol className="grid">{day.entries.map((entry) => entry.row)}</ol>
            </section>
          ),
        }))}
      />
    </div>
  )
}
