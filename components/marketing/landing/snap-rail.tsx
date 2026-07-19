import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Mobile density primitive: below `sm` the list is a horizontal snap rail
 * (cards peek past the viewport edge, page height stays short); from `sm` up
 * it becomes whatever grid the caller passes via `className`. The rail is a
 * real scrollable region on phones, so it is keyboard-focusable and labelled
 * (axe: scrollable-region-focusable). The `-mx-6 px-6` bleed lets cards run
 * to the screen edge while staying inside the Section gutter — the overflow
 * is contained, so the page never scrolls horizontally.
 */
export function SnapRail({
  label,
  className,
  children,
}: {
  label: string
  /** `sm:`+ layout, e.g. "sm:grid-cols-2 lg:grid-cols-4". */
  className?: string
  children: ReactNode
}) {
  return (
    <ul
      aria-label={label}
      tabIndex={0}
      className={cn(
        "focus-ring -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-sm px-6 pb-2 sm:mx-0 sm:grid sm:gap-3.5 sm:overflow-visible sm:px-0 sm:pb-0",
        className
      )}
    >
      {children}
    </ul>
  )
}

/** One rail card: fixed peek width on phones, plain grid cell from `sm` up. */
export function SnapRailItem({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <li
      className={cn(
        "w-[76vw] max-w-xs shrink-0 snap-start sm:w-auto sm:max-w-none sm:shrink",
        className
      )}
    >
      {children}
    </li>
  )
}
