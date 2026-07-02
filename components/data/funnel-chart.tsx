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
    <div className={cn("grid gap-3", className)} role="list" aria-label={ariaLabel}>
      {items.map((item) => {
        const value = Math.max((item.value / max) * 100, 4)

        return (
          <div key={item.label} role="listitem" className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <Eyebrow className="normal-case tracking-normal text-foreground">
                {item.label}
              </Eyebrow>
              <span className="numeric-tabular text-muted-foreground">
                {item.value}
              </span>
            </div>
            <Progress
              value={value}
              aria-label={`${item.label}: ${item.value}`}
              className="h-3"
            />
          </div>
        )
      })}
    </div>
  )
}
