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
              "font-mono text-[0.6875rem] font-bold tracking-[0.04em] uppercase whitespace-nowrap",
              "transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)]",
              "outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none",
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
                    ? "bg-primary-foreground/20 text-primary-foreground"
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
