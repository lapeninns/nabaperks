import { cn } from "@/lib/utils"

export type FunnelChartItem = {
  label: string
  value: number
}

export function FunnelChart({
  items,
  className,
}: {
  items: FunnelChartItem[]
  className?: string
}) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className={cn("grid gap-3", className)} role="list" aria-label="Pilot funnel">
      {items.map((item) => {
        const width = `${Math.max((item.value / max) * 100, 4)}%`

        return (
          <div key={item.label} role="listitem" className="grid gap-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold">{item.label}</span>
              <span className="numeric-tabular text-muted-foreground">
                {item.value}
              </span>
            </div>
            <div className="h-3 rounded-full bg-accent">
              <div
                className="h-full rounded-full bg-reward"
                style={{ width }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
