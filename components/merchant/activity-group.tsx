"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { CategoryBadge, Icon } from "@/components/brand"
import type { ActivityGroup } from "@/lib/merchant/activity-grouping"

import { ActivityDetailCard } from "./activity-detail-card"

/**
 * A collapsed run of same-event rows as a native `<details>`: expansion
 * needs no JS and no aria-expanded bookkeeping, and the state does not
 * persist across navigations. The summary carries the badge, the count
 * headline and the time span; the body is the per-row list, where each row
 * keeps its own primary action (the group header never has one).
 */
export function ActivityGroupDetails({ group }: { group: ActivityGroup }) {
  return (
    <li>
      <details
        data-activity-group={group.key}
        className="group/details surface-card overflow-hidden border-ink"
        onToggle={(event) => {
          if (!event.currentTarget.open) return
          void recordConsoleEventAction({
            name: "activity_group_expanded",
            properties: { category: group.category, count: group.count },
          })
        }}
      >
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="text-sm leading-6 font-extrabold text-foreground">
              {group.headline}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <CategoryBadge
                category={group.category}
                label={group.badgeLabel}
              />
              <span className="numeric-tabular">{group.summary}</span>
            </div>
          </div>
          <span className="mono-id flex shrink-0 items-center gap-1 text-ink-soft">
            <span className="group-open/details:hidden">
              Show {group.count}
            </span>
            <span className="hidden group-open/details:inline">Hide</span>
            <Icon
              icon={ArrowDown01Icon}
              size={14}
              className="transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] group-open/details:rotate-180 motion-reduce:transition-none"
            />
          </span>
        </summary>
        <ol className="grid gap-2 border-t-2 border-dashed border-line px-4 py-3">
          {group.rows.map((row) => (
            <ActivityDetailCard key={row.id} row={row} />
          ))}
        </ol>
      </details>
    </li>
  )
}
