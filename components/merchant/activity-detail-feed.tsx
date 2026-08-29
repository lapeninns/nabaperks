"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { ArrowUp01Icon } from "@hugeicons/core-free-icons"

import { EmptyState, Icon } from "@/components/brand"
import { ConsoleFilterBar, StatStrip } from "@/components/data"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
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
  atCeiling = false,
  ceiling,
  initialFilter = "all",
  initialQuery = "",
  emptyState,
}: {
  summary: ActivitySummary
  rows: ActivityDisplayRow[]
  limit: number
  hasMore: boolean
  /** True once the grown window has hit the page's hard row ceiling. */
  atCeiling?: boolean
  /** The ceiling itself, so the footer can name the wall rather than imply it. */
  ceiling?: number
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
        {/* One console toolbar composition (03#53) — shared with the members
            table via components/data/ConsoleFilterBar. Activity keeps its own
            URL-debounced query strategy; the bar owns the layout only. */}
        <ConsoleFilterBar
          query={query}
          onQueryChange={(nextQuery) => {
            setQuery(nextQuery)
            scheduleQueryUrlWrite(nextQuery)
          }}
          searchPlaceholder="Search activity"
          searchLabel="Search activity"
          filterLabel="Filter activity by type"
          filterValue={filter}
          onFilterChange={(id) => {
            const next = normalizeFilter(id)
            setFilter(next)
            // A pill click writes filter + current query immediately; cancel
            // any debounced query write so it cannot land afterwards with the
            // previous filter captured.
            cancelPendingUrlWrite()
            updateUrl({ filter: next, query })
          }}
          items={filterOptions.map((option) => ({
            id: option.id,
            label: option.label,
          }))}
          resultLabel={
            <>
              {filteredRows.length} shown
              {filteredRows.length === rows.length
                ? ""
                : ` from ${rows.length}`}
              .
            </>
          }
        />
      </section>{" "}
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
            total. At the ceiling the wall is named: the URL limit is clamped
            server-side, so another "Load more" would have re-rendered the same
            rows and read as a bug (03#52). */}
        <p className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "event" : "events"} loaded
          {hasMore && !atCeiling ? ", more available" : ""}.
          {hasMore && atCeiling ? (
            <>
              {" "}
              This page shows the most recent {ceiling ?? rows.length}. Search
              or filter to reach older activity.
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* A grown window is thousands of pixels tall, and every load leaves
              the merchant at the bottom of it (03#52). */}
          {rows.length > 25 ? <BackToTopLink /> : null}
          {hasMore && !atCeiling ? (
            <Button asChild variant="secondary" size="sm">
              {/* The feed's Suspense boundary is keyed on filter only, so this
                  navigation extends the list in place — the label is the only
                  loading signal, hence the useLinkStatus pending swap. */}
              <Link href={loadMoreHref({ filter, limit, query })}>
                <LoadMoreLabel />
              </Link>
            </Button>
          ) : null}
        </div>
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

/**
 * Returns the merchant to the top of the console column after a grown window.
 * `#main` is the shell's `SidebarInset`, which already carries `tabIndex={-1}`,
 * so this moves the keyboard caret as well as the scroll position.
 */
function BackToTopLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <a href="#main">
        <Icon icon={ArrowUp01Icon} size={16} />
        Back to top
      </a>
    </Button>
  )
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
