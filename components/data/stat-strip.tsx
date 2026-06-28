import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StatStripTone = "primary" | "cobalt" | "leaf" | "sun" | "ink"

export type StatStripItem = {
  label: ReactNode
  value: ReactNode
  tone?: StatStripTone
  /** Optional already-rendered glyph shown beside the label. */
  icon?: ReactNode
}

export type StatStripProps = {
  items: StatStripItem[]
  className?: string
}

const TONE_TEXT: Record<StatStripTone, string> = {
  primary: "text-primary",
  cobalt: "text-cobalt",
  leaf: "text-leaf",
  sun: "text-sun",
  ink: "text-foreground",
}

/**
 * A compact "this week" summary strip. Cells are separated by hairline rules via
 * `gap-px` over a `bg-line` ground, so the same markup reads as a clean ruled
 * grid at 2x2 (narrow phones) and 1x4 (sm+) with no per-breakpoint divider math.
 */
export function StatStrip({ items, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "surface-card overflow-hidden p-0 shadow-xs",
        className
      )}
    >
      <div
        className={cn(
          "grid gap-px bg-line",
          items.length >= 4
            ? "grid-cols-2 sm:grid-cols-4"
            : items.length === 3
              ? "grid-cols-3"
              : "grid-cols-2"
        )}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-1 bg-card px-2 py-3 text-center"
          >
            <span
              className={cn(
                "numeric-tabular text-xl leading-none font-extrabold sm:text-2xl",
                TONE_TEXT[item.tone ?? "ink"]
              )}
            >
              {item.value}
            </span>
            <span className="eyebrow flex items-center gap-1">
              {item.icon}
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
