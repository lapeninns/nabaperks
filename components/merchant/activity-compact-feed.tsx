import Link from "next/link"
import type { ReactNode } from "react"

import { CategoryBadge } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type { ActivityDisplayRow } from "@/lib/merchant/activity"
import { cn } from "@/lib/utils"

export function ActivityCompactFeed({
  rows,
  emptyState,
  inset = false,
}: {
  rows: ActivityDisplayRow[]
  emptyState: ReactNode
  /** Drop the outer card chrome when the feed already sits inside a ReceiptCard. */
  inset?: boolean
}) {
  if (!rows.length) {
    return <>{emptyState}</>
  }

  return (
    <ol
      className={cn(
        "overflow-hidden p-0 [&>li+li]:border-t-2 [&>li+li]:border-dashed [&>li+li]:border-ink/15",
        inset ? "rounded-lg bg-background/60" : "surface-card"
      )}
    >
      {rows.map((row) => (
        <li
          key={row.id}
          className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={row.category} label={row.badgeLabel} />
              <time
                dateTime={row.timestamp}
                className="numeric-tabular font-mono text-xs text-muted-foreground"
              >
                {row.relativeTime}
              </time>
            </div>
            <p className="text-sm leading-6 font-bold">{row.headline}</p>
          </div>
          {row.primaryAction ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="min-h-11 sm:min-h-9"
            >
              <Link href={row.primaryAction.href}>
                {row.primaryAction.label}
              </Link>
            </Button>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
