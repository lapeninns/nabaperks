import { cn } from "@/lib/utils"

export type SparklineProps = {
  /** Ordered series values, oldest first. */
  data: number[]
  /** Any CSS color; defaults to the vermillion primary. */
  color?: string
  /** Rendered height in px. Width always fills the container. */
  height?: number
  /** Draw the faint area fill under the line. */
  fill?: boolean
  className?: string
  /** When set the sparkline is announced; otherwise it is decorative. */
  "aria-label"?: string
}

const VIEW_W = 100

type Point = { x: number; y: number }

function buildPoints(data: number[], height: number): Point[] {
  const clean = data.filter((value) => Number.isFinite(value))
  if (clean.length < 2) return []

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1
  const pad = 3
  const usable = height - pad * 2
  const step = VIEW_W / (clean.length - 1)

  return clean.map((value, index) => ({
    x: index * step,
    y: pad + (1 - (value - min) / span) * usable,
  }))
}

/**
 * Tiny inline-SVG sparkline. No charting library exists in this repo, so this
 * is hand-rolled with Wet Ink tokens. `preserveAspectRatio="none"` lets it fill
 * any width while `non-scaling-stroke` keeps the line a constant 2px.
 */
export function Sparkline({
  data,
  color = "var(--primary)",
  height = 32,
  fill = true,
  className,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const points = buildPoints(data, height)
  const hasShape = points.length >= 2
  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const labelProps = ariaLabel
    ? { role: "img" as const, "aria-label": ariaLabel }
    : { "aria-hidden": true }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={cn("block overflow-visible", className)}
      {...labelProps}
    >
      {hasShape ? (
        <>
          {fill ? (
            <path
              d={`M ${line.split(" ")[0]} L ${points
                .slice(1)
                .map((point) => `${point.x},${point.y}`)
                .join(" L ")} L ${VIEW_W},${height} L 0,${height} Z`}
              fill={color}
              fillOpacity={0.12}
            />
          ) : null}
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : (
        <line
          x1={0}
          y1={height / 2}
          x2={VIEW_W}
          y2={height / 2}
          stroke="var(--w-line)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}
