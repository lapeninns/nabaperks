"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * One asset lane at a time on the print channel.
 *
 * The print channel used to stack the poster picker, the table tents, the NFC
 * cards and the wall plates in one column — roughly 2,400px at 390px wide, so a
 * merchant who came for a table tent scrolled past three lanes they did not ask
 * for. The lanes are unchanged; only one is mounted at a time.
 *
 * Toggle buttons in a group rather than an ARIA tablist: a tablist owes the user
 * arrow-key navigation and a roving tabindex, and this row is a filter, not a
 * window into a set of documents. Each button says what it is with `aria-pressed`
 * and stays in the ordinary tab order.
 */

export type PrintAssetLane = {
  readonly id: string
  readonly label: string
  readonly panel: ReactNode
}

export function PrintAssetTabs({
  lanes,
  label,
}: {
  readonly lanes: readonly PrintAssetLane[]
  /** Names the button group for screen readers. */
  readonly label: string
}) {
  const [activeId, setActiveId] = useState<string>(lanes[0]?.id ?? "")
  const active = lanes.find((lane) => lane.id === activeId) ?? lanes[0]

  if (!active) return null

  return (
    <div className="grid min-w-0 gap-4">
      <div
        role="group"
        aria-label={label}
        className="flex min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {lanes.map((lane) => {
          const isActive = lane.id === active.id
          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveId(lane.id)}
              className={cn(
                "focus-ring tap-floor flex min-h-11 shrink-0 items-center rounded-lg border-2 px-3.5 text-sm leading-none font-extrabold whitespace-nowrap transition-[transform,box-shadow,background-color] motion-reduce:transition-none",
                isActive
                  ? "-translate-y-px border-ink bg-secondary shadow-md"
                  : "border-ink/25 bg-card hover:border-ink hover:shadow-sm"
              )}
            >
              {lane.label}
            </button>
          )
        })}
      </div>
      <div className="grid min-w-0 gap-5">{active.panel}</div>
    </div>
  )
}
