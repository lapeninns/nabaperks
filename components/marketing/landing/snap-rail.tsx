"use client"

import { Children, useRef, useState, type ReactNode } from "react"

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
  const railRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const total = Children.count(children)

  // Read the position from the rail rather than tracking each card with an
  // observer: the items are uniform snap points, so scrollLeft over item pitch
  // IS the index, and there is nothing to observe that scroll does not already
  // say. `onScroll` on a scroll container is passive in React.
  function syncActive() {
    const rail = railRef.current

    if (!rail || total === 0) {
      return
    }

    const pitch = rail.scrollWidth / total
    const index = Math.round(rail.scrollLeft / pitch)

    setActive(Math.min(Math.max(index, 0), total - 1))
  }

  return (
    <div className="grid gap-2 sm:block">
      {/* Decorative: the rail itself is a labelled, focusable scroll region,
          so a screen reader already announces it and is not swiping. The hint
          is for sighted touch users only — and at `.mono-id` in the accent
          colour it was the smallest, lowest-contrast text on the page. */}
      <p
        aria-hidden="true"
        className="mono-meta flex items-center justify-end gap-1 text-muted-foreground sm:hidden"
      >
        Swipe to see every card <span>→</span>
      </p>
      {/* How many there are, and where you are — the finding's actual
          complaint was that the only cue eight cards existed was a 10px hint
          (MKT 01#27). Decorative: the rail is a labelled scroll region, so a
          screen reader gets the list length from the list itself and does not
          need a second, worse copy of it. */}
      {total > 1 ? (
        <p
          aria-hidden="true"
          className="mono-meta numeric-tabular justify-self-end text-muted-foreground sm:hidden"
        >
          {active + 1} / {total}
        </p>
      ) : null}
      <ul
        ref={railRef}
        onScroll={syncActive}
        aria-label={label}
        tabIndex={0}
        className={cn(
          "focus-ring -mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-sm px-6 pb-2 sm:mx-0 sm:grid sm:gap-3.5 sm:overflow-visible sm:px-0 sm:pb-0",
          className
        )}
      >
        {children}
      </ul>
    </div>
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
