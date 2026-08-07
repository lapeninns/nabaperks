import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Commit affordance for merchant forms longer than one viewport.
 *
 * Below `sm` the bar sticks to the bottom of the viewport so the merchant can
 * save from anywhere in a 1,400px form; from `sm` up it returns to the flow as
 * an ordinary last row. The rule is the system's 2px ink, not the 1px
 * `border-border/80` the card form used to hand-roll.
 *
 * `offset` exists because the merchant console has two chromes: the full shell
 * carries a `md:hidden` bottom tab bar (56px + safe area) that a sticky bar
 * must clear, while the setup shell (/app/onboarding) has none.
 */
const STICKY_OFFSET = {
  /** Console routes under the full shell — clears the mobile tab bar. */
  "tab-bar": "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]",
  /** Setup shell routes with no tab bar. */
  "safe-area": "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
} as const

export function FormActionBar({
  children,
  hint,
  offset = "tab-bar",
  className,
}: {
  /** The submit control(s). */
  children: ReactNode
  /** Left slot, e.g. an "Unsaved changes" dirty indicator. */
  hint?: ReactNode
  offset?: keyof typeof STICKY_OFFSET
  /** Call-site bleed, e.g. `-mx-6 px-6` inside a `p-6` form. */
  className?: string
}) {
  return (
    <div
      className={cn(
        "sticky z-10 grid gap-2 border-t-2 border-ink bg-card/95 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none",
        STICKY_OFFSET[offset],
        className
      )}
    >
      <p
        aria-live="polite"
        className="mono-meta min-w-0 text-muted-foreground empty:hidden"
      >
        {hint}
      </p>
      <div className="grid min-w-0">{children}</div>
    </div>
  )
}
