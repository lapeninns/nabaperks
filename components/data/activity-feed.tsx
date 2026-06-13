import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type ActivityFeedItem = {
  id: string
  title: ReactNode
  description?: ReactNode
  timestamp?: string
  metadata?: ReactNode
}

export function ActivityFeed({
  items,
  emptyState,
  className,
}: {
  items: ActivityFeedItem[]
  emptyState?: ReactNode
  className?: string
}) {
  if (!items.length && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <ol
      className={cn(
        "surface-card overflow-hidden [&>li+li]:border-t-2 [&>li+li]:border-dashed [&>li+li]:border-ink/15",
        className
      )}
    >
      {items.map((item) => (
        <li key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="grid gap-1">
            <p className="font-bold">{item.title}</p>
            {item.description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            {item.metadata ? (
              <div className="text-xs text-muted-foreground">{item.metadata}</div>
            ) : null}
          </div>
          {item.timestamp ? (
            <time
              dateTime={item.timestamp}
              className="numeric-tabular text-sm text-muted-foreground"
            >
              {formatActivityDate(item.timestamp)}
            </time>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
