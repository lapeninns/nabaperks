"use client"

import type { ReactNode } from "react"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { FilterPills, Icon } from "@/components/brand"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FilterPillItem = {
  id: string
  label: string
  count?: number
}

/**
 * ConsoleFilterBar — the one search + filter toolbar for console lists.
 *
 * Activity and Members each hand-rolled this composition: the same absolutely
 * positioned 16px Search glyph over an `<Input type="search" className="pl-9">`,
 * the same wrapped FilterPills, and the same `role="status"` count line — but
 * with different wrappers and different count wording, so a merchant learned
 * that the toolbar behaves one way on one page and another way on the next.
 *
 * The search field owns the glyph offset and the accessible name; the caller
 * owns the query state (Activity debounces its writes to the URL, Members
 * filters the loaded page), so this unifies the composition without forcing one
 * data strategy on both.
 */
export function ConsoleFilterBar({
  query,
  onQueryChange,
  searchPlaceholder,
  searchLabel,
  filterLabel,
  filterValue,
  onFilterChange,
  items,
  resultLabel,
  className,
  layout = "stacked",
}: {
  readonly query: string
  readonly onQueryChange: (next: string) => void
  readonly searchPlaceholder: string
  readonly searchLabel: string
  readonly filterLabel: string
  readonly filterValue: string
  readonly onFilterChange: (next: string) => void
  readonly items: FilterPillItem[]
  /** Announced result count, e.g. "12 shown from 40". */
  readonly resultLabel?: ReactNode
  readonly className?: string
  /** `inline` puts search and pills on one row from sm up. */
  readonly layout?: "stacked" | "inline"
}) {
  return (
    <div
      className={cn(
        layout === "inline"
          ? "grid gap-3 sm:flex sm:items-center sm:justify-between"
          : "grid gap-3",
        className
      )}
    >
      <div
        className={cn(
          "relative",
          layout === "inline" && "sm:max-w-xs sm:flex-1"
        )}
      >
        <Icon
          icon={Search01Icon}
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="pl-9"
        />
      </div>
      {/* flex-wrap keeps every pill visible on narrow phones instead of
          clipping mid-pill in a hidden-scrollbar row with no affordance. */}
      <FilterPills
        aria-label={filterLabel}
        value={filterValue}
        onValueChange={onFilterChange}
        className={cn("flex-wrap", layout === "inline" && "sm:justify-end")}
        items={items}
      />
      {resultLabel ? (
        <p
          role="status"
          aria-live="polite"
          className="mono-meta text-muted-foreground"
        >
          {resultLabel}
        </p>
      ) : null}
    </div>
  )
}
