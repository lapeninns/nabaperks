"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState, type ReactNode } from "react"

import { EmptyState } from "@/components/brand"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ActivityCategory,
  ActivityDisplayRow,
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
  rows,
  totalCount,
  loadedCount,
  limit,
  initialFilter = "all",
  initialQuery = "",
  emptyState,
}: {
  rows: ActivityDisplayRow[]
  totalCount: number
  loadedCount: number
  limit: number
  initialFilter?: "all" | ActivityCategory
  initialQuery?: string
  emptyState: ReactNode
}) {
  const pathname = usePathname()
  const [filter, setFilter] = useState<"all" | ActivityCategory>(() =>
    normalizeFilter(initialFilter)
  )
  const [query, setQuery] = useState(() => initialQuery)
  const normalizedQuery = query.trim().toLowerCase()

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
      <section className="surface-card grid gap-3 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value
              setQuery(nextQuery)
              updateUrl({ filter, query: nextQuery })
            }}
            placeholder="Search activity"
            aria-label="Search activity"
          />
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={filter === option.id ? "default" : "secondary"}
                  aria-pressed={filter === option.id}
                  onClick={() => {
                    setFilter(option.id)
                    updateUrl({ filter: option.id, query })
                  }}
                >
                  {option.label}
                </Button>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {filteredRows.length} shown
          {filteredRows.length === loadedCount ? "" : ` from ${loadedCount}`}.
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
        <p className="text-xs text-muted-foreground">
          {loadedCount} of {totalCount} events loaded.
        </p>
        {loadedCount < totalCount ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={loadMoreHref({ filter, limit, query })}>Load more</Link>
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
    const nextParams = new URLSearchParams(window.location.search)
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

    const queryString = nextParams.toString()
    window.history.replaceState(
      null,
      "",
      queryString ? `${pathname}?${queryString}` : pathname
    )
  }
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
