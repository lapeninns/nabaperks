import Link from "next/link"

import { cn } from "@/lib/utils"

export type AdminViewTab = {
  readonly id: string
  readonly label: string
  readonly href: string
  /** Optional trailing count, e.g. open flags. */
  readonly count?: number
}

/**
 * URL-driven segmented views for the console. The admin pages stacked one
 * panel per concern — privacy ran to four full panels and three independent
 * paginators on a single ~13,000px scroll — even though the jobs they serve
 * are never needed at the same time. These are real links, not `FilterPills`
 * (which is client-side `onValueChange`), so a view is linkable, back-button
 * safe and works with no JavaScript; the pill silhouette is deliberately the
 * same as `FilterPills` so the console has one segmented-control language.
 */
export function AdminViewTabs({
  label,
  tabs,
  activeId,
  className,
}: {
  readonly label: string
  readonly tabs: readonly AdminViewTab[]
  readonly activeId: string
  readonly className?: string
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex [scrollbar-width:none] gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "tap-floor focus-ring mono-meta inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 tracking-[0.04em] whitespace-nowrap transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none",
              active
                ? "border-ink bg-primary text-primary-foreground shadow-xs forced-colors:underline forced-colors:underline-offset-4"
                : "border-ink bg-card text-ink-soft hover:bg-secondary"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "numeric-tabular rounded-full px-1.5 text-[0.625rem] leading-4",
                  active
                    ? "bg-primary-foreground text-primary"
                    : "bg-paper-deep text-ink-soft"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
