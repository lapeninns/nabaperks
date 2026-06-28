import { cn } from "@/lib/utils"

export type TrendSeries = {
  label: string
  /** Any CSS color used for the line + legend swatch. */
  color: string
  /** Ordered values, oldest first. All series should share length. */
  data: number[]
  /** Draw a faint area fill under this series (use for the primary line). */
  fill?: boolean
}

export type TrendChartProps = {
  series: TrendSeries[]
  /** Mono caption shown at the left of the x-axis (oldest edge). */
  startLabel?: string
  /** Mono caption shown at the right of the x-axis (newest edge). */
  endLabel?: string
  className?: string
  /** Accessible description of the chart. */
  "aria-label"?: string
}

const VIEW_W = 100
const VIEW_H = 60
const PAD_Y = 5

function project(data: number[], min: number, max: number): string {
  const span = max - min || 1
  const usable = VIEW_H - PAD_Y * 2
  // Filter to finite values BEFORE deriving the x-step so the step matches the
  // points actually plotted; otherwise any NaN/Infinity in `data` shrinks the
  // step and slides the line/fill off the x-axis (cf. Sparkline.buildPoints).
  const clean = data.filter((value) => Number.isFinite(value))
  const step = VIEW_W / Math.max(1, clean.length - 1)
  return clean
    .map((value, index) => {
      const x = index * step
      const y = PAD_Y + (1 - (value - min) / span) * usable
      return `${x},${y}`
    })
    .join(" ")
}

/**
 * Compact multi-series trend chart, hand-rolled inline SVG (no chart lib in
 * repo). Shares one 0-based y-scale across series so lines are comparable;
 * legend + axis captions render as real-size HTML so nothing distorts under
 * `preserveAspectRatio="none"`.
 */
export function TrendChart({
  series,
  startLabel,
  endLabel,
  className,
  "aria-label": ariaLabel,
}: TrendChartProps) {
  const all = series.flatMap((entry) => entry.data).filter(Number.isFinite)
  const hasData = all.length > 0 && all.some((value) => value > 0)
  const min = 0
  const max = Math.max(1, ...all)

  return (
    <div className={cn("grid gap-3", className)}>
      {series.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((entry) => (
            <span
              key={entry.label}
              className="flex items-center gap-1.5 font-mono text-[0.65rem] font-bold tracking-[0.06em] text-ink-soft uppercase"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-[3px] border-[1.5px] border-ink"
                style={{ background: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        preserveAspectRatio="none"
        className="block h-28 w-full overflow-visible sm:h-40"
        role="img"
        aria-label={ariaLabel ?? "Trend chart"}
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={0}
            x2={VIEW_W}
            y1={PAD_Y + (VIEW_H - PAD_Y * 2) * fraction}
            y2={PAD_Y + (VIEW_H - PAD_Y * 2) * fraction}
            stroke="var(--w-line)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={0}
          x2={VIEW_W}
          y1={VIEW_H - PAD_Y}
          y2={VIEW_H - PAD_Y}
          stroke="var(--w-ink)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {hasData
          ? series.map((entry) => {
              const pts = project(entry.data, min, max)
              if (!pts) return null
              return (
                <g key={entry.label}>
                  {entry.fill ? (
                    <path
                      d={`M ${pts.split(" ")[0]} L ${pts
                        .split(" ")
                        .slice(1)
                        .join(" L ")} L ${VIEW_W},${VIEW_H - PAD_Y} L 0,${
                        VIEW_H - PAD_Y
                      } Z`}
                      fill={entry.color}
                      fillOpacity={0.12}
                    />
                  ) : null}
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })
          : null}
      </svg>

      {startLabel || endLabel ? (
        <div className="flex justify-between font-mono text-[0.65rem] font-bold tracking-[0.06em] text-ink-soft uppercase">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      ) : null}
    </div>
  )
}
