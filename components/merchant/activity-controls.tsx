"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { FilterPills } from "@/components/brand"
import type { ActivityCategory } from "@/lib/merchant/activity-display"
import {
  ACTIVITY_SCOPE_PILLS,
  type ActivityScope,
} from "@/lib/merchant/activity-scope"

export const ACTIVITY_FILTER_OPTIONS: Array<{
  id: "all" | ActivityCategory
  label: string
}> = [
  { id: "all", label: "All" },
  { id: "customer", label: "Members" },
  { id: "stamp", label: "Stamps" },
  { id: "reward", label: "Rewards" },
  { id: "qr", label: "QR" },
  { id: "account", label: "Account" },
]

/**
 * The feed's scope and category controls. They are URL state, rendered by
 * the page outside the feed's Suspense and error boundary, so a failing or
 * slow query never takes the controls down with it and the owner can always
 * try a narrower selection.
 */
export function ActivityControls({
  filter,
  scope,
  showFilters = true,
}: {
  filter: "all" | ActivityCategory
  scope: ActivityScope
  showFilters?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(next: {
    filter: "all" | ActivityCategory
    scope: ActivityScope
  }) {
    void recordConsoleEventAction({
      name: "activity_filter_changed",
      properties: { filter: next.filter, range: next.scope },
    })
    const params = new URLSearchParams(searchParams.toString())
    if (next.filter === "all") params.delete("filter")
    else params.set("filter", next.filter)
    if (next.scope === "7d") params.delete("range")
    else params.set("range", next.scope)
    params.delete("limit")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="grid gap-3" data-activity-controls>
      <FilterPills
        aria-label="Activity range"
        value={scope}
        onValueChange={(id) => {
          const next = ACTIVITY_SCOPE_PILLS.find((pill) => pill.id === id)?.id
          if (next && next !== scope) navigate({ filter, scope: next })
        }}
        items={ACTIVITY_SCOPE_PILLS.map((pill) => ({
          id: pill.id,
          label: pill.label,
        }))}
      />
      {showFilters ? (
        <FilterPills
          aria-label="Filter activity by type"
          value={filter}
          onValueChange={(id) => {
            const next = ACTIVITY_FILTER_OPTIONS.find(
              (option) => option.id === id
            )?.id
            if (next && next !== filter) navigate({ filter: next, scope })
          }}
          className="flex-wrap"
          items={ACTIVITY_FILTER_OPTIONS.map((option) => ({
            id: option.id,
            label: option.label,
          }))}
        />
      ) : null}
    </div>
  )
}
