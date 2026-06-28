import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { MetricTrendDirection } from "@/lib/merchant/dashboard-trends"
import { metricTrendClassName } from "@/lib/merchant/dashboard-trends"
import { Sparkline } from "@/components/data/sparkline"
import { Card, CardHeader } from "@/components/ui/card"
import { Icon, type IconGlyph } from "./icon"

export type KpiTileProps = {
  label: ReactNode
  value: ReactNode
  trend?: {
    label: string
    direction: MetricTrendDirection
  } | null
  /** Optional leading glyph from the @hugeicons set. */
  icon?: IconGlyph
  /** 14-day series powering the inline sparkline. */
  series?: number[]
  /** Sparkline color; defaults to the metric's trend color when omitted. */
  seriesColor?: string
  className?: string
}

const TREND_STROKE: Record<MetricTrendDirection, string> = {
  up: "var(--reward)",
  down: "var(--destructive)",
  flat: "var(--w-ink-soft)",
}

/**
 * Dashboard KPI tile: mono label + tabular value paired with a 14-day sparkline
 * and a delta-vs-last-week caption. Designed to sit in a 2-up grid on phones
 * and a 4-up grid on desktop (grid is owned by the page).
 */
export function KpiTile({
  label,
  value,
  trend,
  icon,
  series,
  seriesColor,
  className,
}: KpiTileProps) {
  const strokeColor =
    seriesColor ?? (trend ? TREND_STROKE[trend.direction] : "var(--primary)")

  return (
    <Card className={cn("surface-card h-full shadow-xs", className)} size="sm">
      <CardHeader className="h-full gap-2">
        <p className="eyebrow flex min-h-5 items-center gap-1.5">
          {icon ? <Icon icon={icon} size={13} strokeWidth={2.25} /> : null}
          {label}
        </p>
        <div className="flex items-end justify-between gap-3">
          <span className="numeric-tabular text-2xl leading-none font-extrabold sm:text-[1.75rem]">
            {value}
          </span>
          {series && series.length > 1 ? (
            <Sparkline
              data={series}
              color={strokeColor}
              height={28}
              className="w-16 sm:w-20"
            />
          ) : null}
        </div>
        {trend ? (
          <p
            className={cn(
              "font-mono text-[0.65rem] font-bold tracking-[0.06em] uppercase",
              metricTrendClassName(trend.direction)
            )}
          >
            {trend.label}
          </p>
        ) : null}
      </CardHeader>
    </Card>
  )
}
