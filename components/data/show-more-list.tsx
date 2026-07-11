"use client"

import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ShowMoreListItem = {
  key: string
  content: ReactNode
}

/**
 * Progressive reveal for long record-card lists. The server still renders
 * every record (the data is already fetched and the full list stays
 * crawl/print-complete for `initialCount >= items.length`), but phones start
 * from a readable page height instead of a several-thousand-pixel stack.
 * Items are pre-rendered ReactNodes so server components can hand this client
 * wrapper their existing card markup unchanged.
 */
export function ShowMoreList({
  items,
  initialCount,
  step,
  label,
  className,
  listClassName,
}: {
  items: ShowMoreListItem[]
  initialCount: number
  /** How many more each press reveals — defaults to `initialCount`. */
  step?: number
  /** Accessible name for the list (mirrors the table caption). */
  label: string
  className?: string
  listClassName?: string
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount)
  const visible = items.slice(0, visibleCount)
  const remaining = items.length - visible.length
  const nextStep = Math.min(step ?? initialCount, remaining)

  return (
    <div className={cn("grid gap-3", className)}>
      <ul aria-label={label} className={cn("grid gap-2.5", listClassName)}>
        {visible.map((item) => (
          <li key={item.key} className="min-w-0">
            {item.content}
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <div className="grid justify-items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => setVisibleCount((count) => count + nextStep)}
          >
            Show {nextStep} more
          </Button>
          <p role="status" className="text-xs text-muted-foreground">
            Showing {visible.length} of {items.length}
          </p>
        </div>
      ) : null}
    </div>
  )
}
