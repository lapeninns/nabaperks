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
  // No-trend sparklines rest on neutral ink, never on the brand vermillion:
  // primary (#cf330a) sits ~1.1:1 from destructive (#c0301c), so a primary
  // "neutral" line is visually indistinguishable from a falling one.
  const strokeColor =
    seriesColor ?? (trend ? TREND_STROKE[trend.direction] : "var(--w-ink-soft)")

  return (
    // The data-slot layer owns the surface; data-elevation="flat" pins the
    // tile at the same 2px offset as StatStrip so adjacent dashboard tiles
    // share one elevation (a shadow utility here would be silently defeated).
    <Card className={cn("h-full", className)} size="sm" data-elevation="flat">
      <CardHeader className="h-full gap-2">
        <p className="eyebrow flex min-h-5 items-center gap-1.5">
          {icon ? <Icon icon={icon} size={14} strokeWidth={2.25} /> : null}
          {label}
        </p>
        <div className="flex items-end justify-between gap-3">
          <span className="numeric-tabular min-w-0 text-2xl leading-none font-extrabold sm:text-3xl">
            {value}
          </span>
          {series && series.length > 1 ? (
            // Hidden below ~360px: on the 2-up phone grid a 4–5 digit value
            // (e.g. "18,706") holds its min-content width and would starve a
            // shrinkable 64px sparkline into a thin line. Show it once the tile
            // is wide enough for both, and `shrink-0` keeps the chart legible.
            <Sparkline
              data={series}
              color={strokeColor}
              height={28}
              className="hidden w-16 shrink-0 min-[360px]:block sm:w-20"
            />
          ) : null}
        </div>
        {/* Reserved caption row. The Members tile is deliberately trend-less, so
            a conditional row left tile 1 two lines tall against its three-line
            neighbours and knocked the four values off a shared baseline — which
            is the entire job of a KPI strip. The row always renders; a
            trend-less tile spends it on an em dash. */}
        <p
          className={cn(
            "mono-id min-h-4",
            trend
              ? metricTrendClassName(trend.direction)
              : "text-muted-foreground"
          )}
        >
          {trend ? trend.label : "—"}
        </p>
      </CardHeader>
    </Card>
  )
}
