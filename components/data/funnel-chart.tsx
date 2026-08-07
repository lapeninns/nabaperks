import { Eyebrow } from "@/components/brand"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export type FunnelChartItem = {
  label: string
  value: number
}

/**
 * Stacked funnel readback. Bars are the system's ONE progress anatomy — the
 * themed `Progress` primitive (deeper-paper track, leaf fill, squared print
 * radius from the unlayered layer) — so funnel, loyalty track, and readiness
 * meters all read as the same object.
 */
export function FunnelChart({
  items,
  "aria-label": ariaLabel = "Pilot funnel",
  className,
}: {
  items: FunnelChartItem[]
  /** Accessible name for the funnel list — defaults to "Pilot funnel". */
  "aria-label"?: string
  className?: string
}) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div
      className={cn("grid gap-3", className)}
      role="list"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => {
        const trueValue = (item.value / max) * 100
        // Bars are floored at 4% so a tiny step is still visible; without a
        // marker a floored bar reads as real volume, which on the activation
        // funnel is the difference between "1 of 400" and "16 of 400".
        const value = Math.max(trueValue, 4)
        const clamped = trueValue < 4 && item.value > 0
        const previous = index > 0 ? items[index - 1] : null
        const dropOff =
          previous && previous.value > 0
            ? Math.round(((previous.value - item.value) / previous.value) * 100)
            : null

        return (
          <div key={item.label} role="listitem" className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <Eyebrow className="tracking-normal text-foreground normal-case">
                {item.label}
              </Eyebrow>
              <span className="flex items-baseline gap-2">
                {/* The question this chart exists to answer is "where do
                    merchants fall out?", which an absolute count alone cannot
                    answer. */}
                {dropOff !== null && dropOff > 0 ? (
                  <span className="mono-meta text-muted-foreground">
                    down {dropOff}%
                  </span>
                ) : null}
                <span className="numeric-tabular text-muted-foreground">
                  {item.value}
                </span>
              </span>
            </div>
            <Progress
              value={value}
              aria-label={`${item.label}: ${item.value}${
                dropOff !== null && dropOff > 0
                  ? `, down ${dropOff}% from ${previous?.label}`
                  : ""
              }`}
              className="h-3"
            />
            {clamped ? (
              <p className="mono-meta text-muted-foreground">
                bar shown at minimum width
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
