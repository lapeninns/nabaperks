"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDeferredValue, useMemo, useTransition, type ReactNode } from "react"

import { ACTIVITY_CATEGORY_ICON, EmptyState, MonoTag } from "@/components/brand"
import { WetInkRise } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ActivityCategory,
  ActivityDisplayRow,
} from "@/lib/merchant/activity"
import { cn } from "@/lib/utils"

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const filter = normalizeFilter(searchParams.get("filter") ?? initialFilter)
  const query = searchParams.get("q") ?? initialQuery
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const categoryMatches = filter === "all" || row.category === filter
      const queryMatches =
        deferredQuery.length === 0 ||
        row.searchText.includes(deferredQuery) ||
        row.headline.toLowerCase().includes(deferredQuery) ||
        row.summary.toLowerCase().includes(deferredQuery)

      return categoryMatches && queryMatches
    })
  }, [deferredQuery, filter, rows])

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
              updateUrl({ q: event.target.value, limit: String(limit) })
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
                    updateUrl({
                      filter: option.id === "all" ? "" : option.id,
                      limit: String(limit),
                    })
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
          {loadedCount} of {totalCount} events loaded
          {isPending ? " while updating filters" : ""}.
        </p>
        {loadedCount < totalCount ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={loadMoreHref(searchParams, limit)}>Load more</Link>
          </Button>
        ) : null}
      </footer>
    </div>
  )

  function updateUrl(values: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(values)) {
      if (value.trim().length === 0) {
        nextParams.delete(key)
      } else {
        nextParams.set(key, value)
      }
    }

    startTransition(() => {
      const queryString = nextParams.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      })
    })
  }
}

function ActivityDetailCard({ row }: { row: ActivityDisplayRow }) {
  return (
    <li className="relative pl-5">
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-4 left-0 size-2.5 rounded-full border-2 border-ink ring-4 ring-background",
          activityDotClass(row.category)
        )}
      />
      <article className="group/activity surface-card border-ink px-4 py-3 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5">
        <div className="min-w-0">
          <p className="text-sm leading-6 font-extrabold text-foreground">
            {row.headline}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <CategoryBadge category={row.category} label={row.badgeLabel} />
            <span
              aria-hidden="true"
              className="hidden size-1 rounded-full bg-muted-foreground/35 sm:inline-block"
            />
            <time dateTime={row.timestamp} className="numeric-tabular">
              {row.relativeTime} at {row.timestampLabel}
            </time>
          </div>
        </div>
      </article>
    </li>
  )
}

function CategoryBadge({
  category,
  label,
}: {
  category: ActivityCategory
  label: string
}) {
  return (
    <MonoTag
      tone={categoryBadgeTone(category)}
      icon={ACTIVITY_CATEGORY_ICON[category]}
      className={cn(
        categoryBadgeTone(category) === "plain" && categoryBadgeClass(category)
      )}
    >
      {label}
    </MonoTag>
  )
}

function categoryBadgeTone(
  category: ActivityCategory
): "plain" | "accent" | "ink" | "leaf" | "sun" {
  switch (category) {
    case "customer":
      return "accent"
    case "stamp":
      return "ink"
    case "reward":
      return "leaf"
    case "qr":
      return "sun"
    case "account":
      return "plain"
  }
}

function activityDotClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "bg-accent"
    case "stamp":
      return "bg-primary"
    case "reward":
      return "bg-reward"
    case "qr":
      return "bg-qr"
    case "account":
      return "bg-muted-foreground"
  }
}

function categoryBadgeClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "border-accent/80 bg-accent text-accent-foreground"
    case "stamp":
      return "border-primary/20 bg-primary/10 text-primary"
    case "reward":
      return "border-reward/25 bg-reward/10 text-reward"
    case "qr":
      return "border-qr/20 bg-qr/10 text-foreground"
    case "account":
      return "border-border bg-secondary/70 text-secondary-foreground"
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
  return filterOptions.some((option) => option.id === value)
    ? (value as "all" | ActivityCategory)
    : "all"
}

function loadMoreHref(searchParams: URLSearchParams, limit: number) {
  const nextParams = new URLSearchParams(searchParams.toString())
  nextParams.set("limit", String(limit + 50))
  return `/app/activity?${nextParams.toString()}`
}
