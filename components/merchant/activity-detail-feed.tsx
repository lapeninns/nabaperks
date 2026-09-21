"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { QrCode01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { recordConsoleEventAction } from "@/app/app/console-events"
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
import {
  groupActivityRows,
  isActivityGroup,
  type ActivityListEntry,
} from "@/lib/merchant/activity-grouping"
import {
  ACTIVITY_SCOPE_PILLS,
  activityScopeLabel,
  type ActivityScope,
} from "@/lib/merchant/activity-scope"

import { ActivityDetailCard } from "./activity-detail-card"
import { ActivityGroupDetails } from "./activity-group"

const filterOptions: Array<{
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

const filterLabel = (filter: "all" | ActivityCategory) =>
  filterOptions.find((option) => option.id === filter)?.label.toLowerCase() ??
  "matching"

/**
 * The owner's activity read (handoff §6.2, §7.3). Scope (Today / 7 days /
 * 28 days) and category filter are server-side query params so "Load more"
 * grows the scoped, filtered set; the search box is a client refinement over
 * the loaded window. Same-event runs of QR scans and joins collapse into
 * `<details>` groups; reward rows never do. One row means no grouping and
 * no filter pills.
 */
export function ActivityDetailFeed({
  summary,
  rows,
  limit,
  hasMore,
  initialFilter = "all",
  initialQuery = "",
  initialScope = "7d",
  posterHref = "/app/qr",
}: {
  summary: ActivitySummary
  rows: ActivityDisplayRow[]
  limit: number
  hasMore: boolean
  initialFilter?: "all" | ActivityCategory
  initialQuery?: string
  initialScope?: ActivityScope
  /** Accepted for API compatibility with the previous feed; empty states
   *  are owned here now. */
  emptyState?: ReactNode
  posterHref?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState<"all" | ActivityCategory>(() =>
    normalizeFilter(initialFilter)
  )
  const [query, setQuery] = useState(() => initialQuery)
  const scope = initialScope
  const normalizedQuery = query.trim().toLowerCase()

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
      updateUrl({ filter, query: nextQuery, scope })
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
    () =>
      groupRowsByDate(
        rows.length > 1 ? groupActivityRows(filteredRows) : filteredRows
      ),
    [filteredRows, rows.length]
  )

  const singleRow = rows.length === 1
  const scopeLabel = activityScopeLabel(scope)

  const scopePills = (
    <FilterPills
      aria-label="Activity range"
      value={scope}
      onValueChange={(id) => {
        const next = ACTIVITY_SCOPE_PILLS.find((pill) => pill.id === id)?.id
        if (!next || next === scope) return
        cancelPendingUrlWrite()
        void recordConsoleEventAction({
          name: "activity_filter_changed",
          properties: { filter, range: next },
        })
        updateUrl({ filter, query, scope: next })
      }}
      items={ACTIVITY_SCOPE_PILLS.map((pill) => ({
        id: pill.id,
        label: pill.label,
      }))}
    />
  )

  if (!rows.length) {
    return (
      <div className="grid gap-4">
        {scopePills}
        <ActivityEmpty
          filter={filter}
          scope={scope}
          posterHref={posterHref}
          onClearFilter={() => {
            setFilter("all")
            updateUrl({ filter: "all", query, scope })
          }}
          onWiden={() => updateUrl({ filter, query, scope: "7d" })}
        />
      </div>
    )
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
        {scopePills}
        {singleRow ? null : (
          <>
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
            <FilterPills
              aria-label="Filter activity by type"
              value={filter}
              onValueChange={(id) => {
                const next = normalizeFilter(id)
                setFilter(next)
                cancelPendingUrlWrite()
                void recordConsoleEventAction({
                  name: "activity_filter_changed",
                  properties: { filter: next, range: scope },
                })
                updateUrl({ filter: next, query, scope })
              }}
              className="flex-wrap"
              items={filterOptions.map((option) => ({
                id: option.id,
                label: option.label,
              }))}
            />
          </>
        )}
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
          actions={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFilter("all")
                setQuery("")
                cancelPendingUrlWrite()
                updateUrl({ filter: "all", query: "", scope })
              }}
            >
              Clear filter
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {groupedRows.map(([dateGroup, dateLabel, entries], groupIndex) => (
            <WetInkRise
              key={dateGroup}
              className="grid gap-2"
              delay={groupIndex * 0.04}
              distance={10}
            >
              <h2 className="eyebrow text-muted-foreground">{dateLabel}</h2>
              <ol className="grid gap-2">
                {entries.map((entry) =>
                  isActivityGroup(entry) ? (
                    <ActivityGroupDetails key={entry.key} group={entry} />
                  ) : (
                    <ActivityDetailCard key={entry.id} row={entry} />
                  )
                )}
              </ol>
            </WetInkRise>
          ))}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "event" : "events"} in {scopeLabel}
          {hasMore ? ", more available" : ""}.
        </p>
        {hasMore ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="min-h-11 sm:min-h-9"
          >
            <Link href={loadMoreHref({ filter, limit, query, scope })}>
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
    scope: nextScope,
  }: {
    filter: "all" | ActivityCategory
    query: string
    scope: ActivityScope
  }) {
    const nextParams = new URLSearchParams(searchParams.toString())
    const trimmedQuery = nextQuery.trim()

    if (nextFilter === "all") nextParams.delete("filter")
    else nextParams.set("filter", nextFilter)

    if (trimmedQuery.length === 0) nextParams.delete("q")
    else nextParams.set("q", trimmedQuery)

    if (nextScope === "7d") nextParams.delete("range")
    else nextParams.set("range", nextScope)

    nextParams.delete("limit")

    const queryString = nextParams.toString()
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }
}

function ActivityEmpty({
  filter,
  scope,
  posterHref,
  onClearFilter,
  onWiden,
}: {
  filter: "all" | ActivityCategory
  scope: ActivityScope
  posterHref: string
  onClearFilter: () => void
  onWiden: () => void
}) {
  if (filter !== "all") {
    return (
      <div data-activity-empty="filtered">
        <EmptyState
          title={`No ${filterLabel(filter)} activity in ${activityScopeLabel(scope)}.`}
          description="Try another category, or widen the range."
          actions={
            <Button type="button" variant="secondary" onClick={onClearFilter}>
              Clear filter
            </Button>
          }
        />
      </div>
    )
  }

  if (scope === "today") {
    return (
      <div data-activity-empty="today">
        <EmptyState
          title="Nothing yet today."
          description="Scans, joins and stamps land here as they happen."
          actions={
            <Button type="button" variant="secondary" onClick={onWiden}>
              See the last 7 days
            </Button>
          }
        />
      </div>
    )
  }

  if (scope === "7d") {
    return (
      <div data-activity-empty="week">
        <EmptyState
          title="Nothing in the last 7 days."
          description="A quiet week. The last 28 days may have more."
          actions={
            <Button asChild variant="secondary">
              <Link href="?range=28d" prefetch={false}>
                See the last 28 days
              </Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div data-activity-empty="new">
      <EmptyState
        title="Nothing here yet."
        description="The first scan of your QR lands here."
        icon={QrCode01Icon}
        actions={
          <Button asChild>
            <Link href={posterHref} prefetch={false}>
              Open your Poster kit
            </Link>
          </Button>
        }
      />
    </div>
  )
}

/** Pending feedback for the in-place "Load more" navigation. */
function LoadMoreLabel() {
  const { pending } = useLinkStatus()
  return <>{pending ? "Loading…" : "Load more"}</>
}

function groupRowsByDate(entries: readonly ActivityListEntry[]) {
  const groups: Array<[string, string, ActivityListEntry[]]> = []
  const groupIndexes = new Map<string, number>()

  for (const entry of entries) {
    const existingIndex = groupIndexes.get(entry.dateGroup)
    if (existingIndex == null) {
      groupIndexes.set(entry.dateGroup, groups.length)
      groups.push([entry.dateGroup, entry.dateGroupLabel, [entry]])
    } else {
      groups[existingIndex][2].push(entry)
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
  scope,
}: {
  filter: "all" | ActivityCategory
  limit: number
  query: string
  scope: ActivityScope
}) {
  const nextParams = new URLSearchParams()
  const trimmedQuery = query.trim()

  if (filter !== "all") nextParams.set("filter", filter)
  if (trimmedQuery.length > 0) nextParams.set("q", trimmedQuery)
  if (scope !== "7d") nextParams.set("range", scope)
  nextParams.set("limit", String(limit + 25))

  return `?${nextParams.toString()}`
}
