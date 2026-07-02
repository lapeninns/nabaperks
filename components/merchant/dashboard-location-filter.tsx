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
        "inline-flex min-h-10 items-center rounded-full border-2 border-ink px-4 py-2 text-sm font-black transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none motion-reduce:transition-none",
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-hard)]"
          : "bg-card text-ink shadow-[var(--shadow-hard-sm)]"
      )}
    >
      {children}
    </Link>
  )
}
