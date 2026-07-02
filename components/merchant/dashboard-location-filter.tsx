import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type DashboardLocationOption = {
  readonly id: string
  readonly name: string
  readonly isPrimary?: boolean
}

export function DashboardLocationFilter({
  locations,
  activeLocationId,
  baseHref = "/app",
}: {
  readonly locations: readonly DashboardLocationOption[]
  readonly activeLocationId?: string | null
  readonly baseHref?: string
}) {
  if (locations.length <= 1) return null

  return (
    <nav aria-label="Dashboard location" className="flex flex-wrap gap-2">
      <LocationPill href={baseHref} active={!activeLocationId}>
        All sites
      </LocationPill>
      {locations.map((location) => (
        <LocationPill
          key={location.id}
          href={`${baseHref}?location=${encodeURIComponent(location.id)}`}
          active={activeLocationId === location.id}
        >
          {location.name}
        </LocationPill>
      ))}
    </nav>
  )
}

/**
 * A site filter in the FilterPills idiom (the sanctioned mono pill voice for
 * exactly this job — see components/brand/filter-pills.tsx): 36px mono pill
 * on fine pointers growing to the 44px tap floor on coarse pointers,
 * selected = vermillion, focus from the shared `.focus-ring` recipe. Links,
 * not buttons, because the dashboard filter is URL-driven.
 */
function LocationPill({
  href,
  active,
  children,
}: {
  readonly href: string
  readonly active: boolean
  readonly children: ReactNode
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5",
        "[@media(pointer:coarse)]:min-h-11",
        "font-mono text-[0.6875rem] font-bold tracking-[0.04em] uppercase whitespace-nowrap",
        "transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)]",
        "focus-ring outline-none motion-reduce:transition-none",
        active
          ? "border-ink bg-primary text-primary-foreground shadow-xs"
          : "border-ink bg-card text-ink-soft hover:bg-secondary"
      )}
    >
      {/* Long site names truncate rather than overflowing the wrap row (the
          MonoTag long-copy contract). */}
      <span className="truncate">{children}</span>
    </Link>
  )
}
