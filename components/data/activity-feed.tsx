import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  ACTIVITY_CATEGORY_ICON,
  Icon,
  type ActivityCategory,
} from "@/components/brand"

/** Category dot tones — mirror the merchant feed badge vocabulary (MoEventRow). */
export type ActivityFeedTone = "accent" | "ink" | "leaf" | "sun" | "plain"

const DOT_TONE: Record<ActivityFeedTone, string> = {
  accent: "bg-primary",
  ink: "bg-ink",
  leaf: "bg-reward",
  sun: "bg-seal",
  plain: "bg-muted-foreground",
}

export type ActivityFeedItem = {
  id: string
  title: ReactNode
  description?: ReactNode
  timestamp?: string
  metadata?: ReactNode
  /** Optional leading category dot — the MoEventRow event marker. */
  tone?: ActivityFeedTone
  /**
   * Optional semantic category. When set, the row leads with the canonical
   * glyph from ACTIVITY_CATEGORY_ICON (the same map CategoryBadge uses), so
   * one event reads the same on every surface. Takes precedence over `tone`.
   */
  category?: ActivityCategory
}

export function ActivityFeed({
  items,
  emptyState,
  "aria-label": ariaLabel,
  className,
}: {
  items: ActivityFeedItem[]
  emptyState?: ReactNode
  /** Accessible name for the feed list (parity with DataTable's caption). */
  "aria-label"?: string
  className?: string
}) {
  if (!items.length && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        "surface-card overflow-hidden [&>li+li]:border-t-2 [&>li+li]:border-dashed [&>li+li]:border-line",
        className
      )}
    >
      {items.map((item) => (
        <li
          key={item.id}
          className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start"
        >
          <div className="grid gap-1">
            <p className="flex items-center gap-2 font-bold">
              {item.category ? (
                <Icon
                  icon={ACTIVITY_CATEGORY_ICON[item.category]}
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
              ) : item.tone ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 shrink-0 rounded-full border-2 border-ink",
                    DOT_TONE[item.tone]
                  )}
                />
              ) : null}
              {item.title}
            </p>
            {item.description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            {item.metadata ? (
              <div className="text-xs text-muted-foreground">
                {item.metadata}
              </div>
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
