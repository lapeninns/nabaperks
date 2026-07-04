import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * SnapRail — mobile-only horizontal card rail for landing card lists.
 *
 * Below `sm` the list becomes a swipeable snap row (the venue-proof ribbon
 * recipe); from `sm` up the caller's own grid classes take over via
 * `trackClassName`, so desktop/tablet layout is untouched. The scroller is a
 * labelled, focusable region (axe `scrollable-region-focusable` is in the CI
 * sweep) with the comparison-table right-edge fade + `.mono-id` swipe hint.
 * `fadeFrom="ink"` matches rails sitting on a ContrastBand (`bg-ink`).
 *
 * `scroll-snap-type` lives on the scroll container (the inner `w-max` track
 * cannot snap — that was the inert bit of the original ribbon recipe), and the
 * track keeps `role="list"` because flex + list-style stripping drops list
 * semantics in Safari/VoiceOver. Items add `SNAP_RAIL_ITEM` plus a mobile
 * width (e.g. `max-sm:w-[min(17rem,78vw)]`).
 *
 * Server component — pure CSS, no JS.
 */
export const SNAP_RAIL_ITEM = "max-sm:shrink-0 max-sm:snap-start"

type SnapRailProps = {
  as?: "ol" | "ul" | "div"
  label: string
  hint?: string
  fadeFrom?: "background" | "ink"
  className?: string
  trackClassName?: string
  children: ReactNode
}

export function SnapRail({
  as: Track = "div",
  label,
  hint,
  fadeFrom = "background",
  className,
  trackClassName,
  children,
}: SnapRailProps) {
  const onInk = fadeFrom === "ink"

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="focus-ring min-w-0 overflow-x-auto overflow-y-hidden py-1 outline-none [-ms-overflow-style:none] [scrollbar-width:none] max-sm:snap-x max-sm:snap-proximity sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        <Track
          role="list"
          className={cn(
            "flex w-max max-w-full items-stretch gap-3 pb-1 max-sm:pe-1 sm:w-full sm:pb-0",
            trackClassName
          )}
        >
          {children}
        </Track>
      </div>
      {/* Right-edge fade: signals cards sitting off-screen; gone from `sm`
          where the caller's grid takes over. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent sm:hidden",
          onInk ? "from-ink" : "from-background"
        )}
      />
      {hint ? (
        <p
          className={cn(
            "mono-id mt-2 font-normal sm:hidden",
            onInk ? "text-paper/70" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
