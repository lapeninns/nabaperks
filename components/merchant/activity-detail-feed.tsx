"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { Search01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, FilterPills, Icon } from "@/components/brand"
import { StatStrip } from "@/components/data"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ActivityCategory,
  ActivityDisplayRow,
  ActivitySummary,
} from "@/lib/merchant/activity"

import { ActivityDetailCard } from "./activity-detail-card"

const filterOptions: Array<{
  id: "all" | ActivityCategory
  label: string
}> = [
  { id: "all", label: "All" },
  { id: "customer", label: "Joins" },
  { id: "stamp", label: "Stamps" },
  { id: "reward", label: "Rewards" },
  { id: "qr", label: "QR" },
  { id: "account", label: "Account" },
]

export function ActivityDetailFeed({
  summary,
  rows,
  limit,
  hasMore,
  initialFilter = "all",
  initialQuery = "",
  emptyState,
}: {
  summary: ActivitySummary
  rows: ActivityDisplayRow[]
  limit: number
  hasMore: boolean
  initialFilter?: "all" | ActivityCategory
  initialQuery?: string
  emptyState: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  // These initializers re-run whenever this component remounts; the server
  // re-keys it by the discrete nav params (filter:limit), so a soft nav via
  // "Load more" or a filter pill re-initializes instead of going stale.
  const [filter, setFilter] = useState<"all" | ActivityCategory>(() =>
    normalizeFilter(initialFilter)
  )
  const [query, setQuery] = useState(() => initialQuery)
  const normalizedQuery = query.trim().toLowerCase()

  // Debounce the URL write for typed searches: client filtering is already
  // instant, so the router.replace (an RSC refetch on this force-dynamic
  // page) only needs to fire once the merchant pauses, not per keystroke.
  const urlWriteTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (urlWriteTimer.current !== null) {
        window.clearTimeout(urlWriteTimer.current)
      }
    },
    []
  )

  function cancelPendingUrlWrite() {
    if (urlWriteTimer.current !== null) {
      window.clearTimeout(urlWriteTimer.current)
      urlWriteTimer.current = null
    }
  }

  function scheduleQueryUrlWrite(nextQuery: string) {
    cancelPendingUrlWrite()
    urlWriteTimer.current = window.setTimeout(() => {
      urlWriteTimer.current = null
      updateUrl({ filter, query: nextQuery })
    }, 300)
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const categoryMatches = filter === "all" || row.category === filter
      const queryMatches =
        normalizedQuery.length === 0 ||
        row.searchText.includes(normalizedQuery) ||
        row.headline.toLowerCase().includes(normalizedQuery) ||
        row.summary.toLowerCase().includes(normalizedQuery)

      return categoryMatches && queryMatches
    })
  }, [filter, normalizedQuery, rows])

  const groupedRows = useMemo(
    () => groupRowsByDate(filteredRows),
    [filteredRows]
  )

  if (!rows.length) {
    return <>{emptyState}</>
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <p className="eyebrow">This week</p>
        <StatStrip
          items={[
            { label: "Stamps", value: summary.stamps, tone: "primary" },
            { label: "Joins", value: summary.joins, tone: "cobalt" },
            { label: "Rewards", value: summary.rewards, tone: "leaf" },
            { label: "QR", value: summary.qrEvents, tone: "sun" },
          ]}
        />
      </section>

      <section className="surface-card grid gap-3 p-3 sm:p-4">
        <div className="relative">
          <Icon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value
              setQuery(nextQuery)
              scheduleQueryUrlWrite(nextQuery)
            }}
            placeholder="Search activity"
            aria-label="Search activity"
            className="pl-9"
          />
        </div>
        {/* flex-wrap keeps every pill visible on narrow phones instead of
            clipping mid-pill in the hidden-scrollbar row with no affordance
            (same fix as the members table). */}
        <FilterPills
          aria-label="Filter activity by type"
          value={filter}
          onValueChange={(id) => {
            const next = normalizeFilter(id)
            setFilter(next)
            // A pill click writes filter + current query immediately; cancel
            // any debounced query write so it cannot land afterwards with the
            // previous filter captured.
            cancelPendingUrlWrite()
            updateUrl({ filter: next, query })
          }}
          className="flex-wrap"
          items={filterOptions.map((option) => ({
            id: option.id,
            label: option.label,
          }))}
        />
        {/* Announce the result count (and the empty state below) to assistive
            tech as it changes. Compare against rows.length — the number of
            rendered cards — not the raw event count, so "from N" only appears
            when the search/filter actually hides rows. */}
        <p
          className="text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {filteredRows.length} shown
          {filteredRows.length === rows.length ? "" : ` from ${rows.length}`}.
        </p>
      </section>

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No events in this filter"
          description="Try another category or clear the search to see more of the loaded activity."
        />
      ) : (
        <div className="grid gap-6">
          {groupedRows.map(([dateGroup, dateLabel, groupRows], groupIndex) => (
            <WetInkRise
              key={dateGroup}
              className="grid gap-2"
              delay={groupIndex * 0.04}
              distance={10}
            >
              <h2 className="eyebrow text-muted-foreground">{dateLabel}</h2>
              <ol className="grid gap-2">
                {groupRows.map((row) => (
                  <ActivityDetailCard key={row.id} row={row} />
                ))}
              </ol>
            </WetInkRise>
          ))}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Count the rendered rows (threaded), not raw product_events, so the
            number matches the cards on screen. `hasMore` (the server's +1
            sentinel) drives the affordance instead of a now-removed exact
            total. */}
        <p className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "event" : "events"} loaded
          {hasMore ? ", more available" : ""}.
        </p>
        {hasMore ? (
          <Button asChild variant="secondary" size="sm">
            {/* The feed's Suspense boundary is keyed on filter only, so this
                navigation extends the list in place — the label is the only
                loading signal, hence the useLinkStatus pending swap. */}
            <Link href={loadMoreHref({ filter, limit, query })}>
              <LoadMoreLabel />
            </Link>
          </Button>
        ) : null}
      </footer>
    </div>
  )

  function updateUrl({
    filter: nextFilter,
    query: nextQuery,
  }: {
    filter: "all" | ActivityCategory
    query: string
  }) {
    // Build from the live searchParams and update via the Next router (not
    // window.history.replaceState) so the router cache stays in sync and the
    // back button works. Changing the filter or query starts a fresh window,
    // so drop the grown `limit`.
    const nextParams = new URLSearchParams(searchParams.toString())
    const trimmedQuery = nextQuery.trim()

    if (nextFilter === "all") {
      nextParams.delete("filter")
    } else {
      nextParams.set("filter", nextFilter)
    }

    if (trimmedQuery.length === 0) {
      nextParams.delete("q")
    } else {
      nextParams.set("q", trimmedQuery)
    }

    nextParams.delete("limit")

    const queryString = nextParams.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }
}

/** Pending feedback for the in-place "Load more" navigation. */
function LoadMoreLabel() {
  const { pending } = useLinkStatus()
  return <>{pending ? "Loading…" : "Load more"}</>
}

function groupRowsByDate(rows: ActivityDisplayRow[]) {
  const groups: Array<[string, string, ActivityDisplayRow[]]> = []
  const groupIndexes = new Map<string, number>()

  for (const row of rows) {
    const existingIndex = groupIndexes.get(row.dateGroup)
    if (existingIndex == null) {
      groupIndexes.set(row.dateGroup, groups.length)
      groups.push([row.dateGroup, row.dateGroupLabel, [row]])
    } else {
      groups[existingIndex][2].push(row)
    }
  }

  return groups
}

function normalizeFilter(value: string): "all" | ActivityCategory {
  switch (value) {
    case "all":
    case "customer":
    case "stamp":
    case "reward":
    case "qr":
    case "account":
      return value
    default:
      return "all"
  }
}

function loadMoreHref({
  filter,
  limit,
  query,
}: {
  filter: "all" | ActivityCategory
  limit: number
  query: string
}) {
  const nextParams = new URLSearchParams()
  const trimmedQuery = query.trim()

  if (filter !== "all") {
    nextParams.set("filter", filter)
  }

  if (trimmedQuery.length > 0) {
    nextParams.set("q", trimmedQuery)
  }

  nextParams.set("limit", String(limit + 50))
  return `/app/activity?${nextParams.toString()}`
}
