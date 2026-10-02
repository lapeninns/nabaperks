"use client"

import type { KeyboardEvent, ReactNode } from "react"

function scrollComparison(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    !["ArrowLeft", "ArrowRight"].includes(event.key) ||
    !(event.target instanceof HTMLElement) ||
    !event.target.matches('[data-slot="table-container"]')
  ) {
    return
  }
  event.preventDefault()
  event.target.scrollBy({
    left:
      ((event.key === "ArrowRight" ? 1 : -1) * event.target.clientWidth) / 2,
    behavior: "instant",
  })
}

export function ComparisonTableFrame({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <div
      className="hidden min-w-0 rounded-lg border-2 border-ink bg-card lg:block"
      onKeyDown={scrollComparison}
    >
      {children}
    </div>
  )
}
