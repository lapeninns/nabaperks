"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { CategoryBadge } from "@/components/brand"
import { Button } from "@/components/ui/button"
import type {
  ActivityCategory,
  ActivityDisplayRow,
} from "@/lib/merchant/activity"
import { cn } from "@/lib/utils"

type ActivityDetailCardProps = {
  readonly row: ActivityDisplayRow
}

export function ActivityDetailCard({ row }: ActivityDetailCardProps) {
  return (
    <li className="relative pl-5 before:absolute before:top-5 before:left-1 before:h-[calc(100%+0.625rem)] before:w-0.5 before:bg-line before:content-[''] last:before:hidden">
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-4 left-0 z-10 size-2.5 rounded-full border-2 border-ink ring-4 ring-background",
          activityDotClass(row.category)
        )}
      />
      <article className="group/activity surface-card border-ink px-4 py-3 transition-[border-color,box-shadow,transform] duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none hover:-translate-y-0.5">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0">
            <p className="text-sm leading-6 font-extrabold text-foreground">
              {row.headline}
            </p>
            {row.summary ? (
              <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                {row.summary}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <CategoryBadge category={row.category} label={row.badgeLabel} />
              <span
                aria-hidden="true"
                className="hidden size-1 rounded-full bg-muted-foreground/35 sm:inline-block"
              />
              <time dateTime={row.timestamp} className="numeric-tabular">
                <RelativeTime
                  timestamp={row.timestamp}
                  fallback={row.relativeTime}
                />{" "}
                at {row.timestampLabel}
              </time>
            </div>
          </div>
          {row.primaryAction ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="min-h-11 justify-self-start sm:min-h-9 sm:justify-self-end"
            >
              <Link href={row.primaryAction.href}>
                {row.primaryAction.label}
              </Link>
            </Button>
          ) : null}
        </div>
      </article>
    </li>
  )
}

/**
 * Re-derives the human-readable "X ago" string on the client so it does not go
 * stale on a long-lived tab. The server-rendered `fallback` is shown first (so
 * SSR and the first paint match), then the string refreshes on an interval. The
 * absolute `dateTime`/`timestampLabel` stays authoritative; only the relative
 * phrase is recomputed, and only while it is still within the relative window.
 */
function RelativeTime({
  timestamp,
  fallback,
}: {
  readonly timestamp: string
  readonly fallback: string
}) {
  const [label, setLabel] = useState(fallback)

  useEffect(() => {
    const update = () => {
      const next = relativeTimeFromNow(timestamp)
      // Beyond the relative window the server emits an absolute date that never
      // goes stale — keep showing it rather than drifting from the server format.
      setLabel(next ?? fallback)
    }

    update()
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [timestamp, fallback])

  return <>{label}</>
}

/**
 * Mirror of the relative window in `lib/merchant/activity` (`formatRelativeTime`).
 * Returns `null` past seven days so the caller can fall back to the server's
 * locale-correct absolute label instead of re-implementing the timezone format.
 */
function relativeTimeFromNow(value: string): string | null {
  const diffMs = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diffMs)) return null

  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return "Just now"
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute)
    return `${minutes} min ago`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `${hours} hr ago`
  }
  const days = Math.floor(diffMs / day)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return null
}

function activityDotClass(category: ActivityCategory) {
  switch (category) {
    case "customer":
      return "bg-accent"
    case "stamp":
      return "bg-primary"
    case "reward":
      return "bg-reward"
    case "qr":
      return "bg-qr"
    case "account":
      return "bg-muted-foreground"
  }
}
