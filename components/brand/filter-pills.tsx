"use client"

import { cn } from "@/lib/utils"

export type FilterPillItem = {
  id: string
  label: string
  /** Optional count rendered as a trailing chip. */
  count?: number
}

export type FilterPillsProps = {
  items: FilterPillItem[]
  value: string
  onValueChange: (id: string) => void
  className?: string
  "aria-label"?: string
}

/**
 * Horizontally-scrollable mono filter pills shared by Customers + Activity.
 * Built from plain buttons (not the themed Button) so the selected = vermillion
 * treatment is not overridden by the unlayered data-slot restyle layer. The row
 * scrolls on narrow phones and hides its scrollbar.
 */
export function FilterPills({
  items,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
}: FilterPillsProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onValueChange(item.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5",
              // Compact 36px pill on fine pointers keeps the scrollable row's
              // visual rhythm; on coarse (touch) pointers the hit area grows to
              // the 44px Wet Ink tap-target minimum (DESIGN.md, WCAG 2.5.8)
              // without distorting the desktop pill height.
              "[@media(pointer:coarse)]:min-h-11",
              "font-mono text-[0.6875rem] font-bold tracking-[0.04em] uppercase whitespace-nowrap",
              "transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)]",
              // Focus comes from the shared .focus-ring recipe (globals.css).
              "focus-ring outline-none motion-reduce:transition-none",
              selected
                ? "border-ink bg-primary text-primary-foreground shadow-xs"
                : "border-ink bg-card text-ink-soft hover:bg-secondary"
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "numeric-tabular rounded-full px-1.5 text-[0.625rem] leading-4",
                  selected
                    ? "bg-primary-foreground text-primary"
                    : "bg-paper-deep text-ink-soft"
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
