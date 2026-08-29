"use client"

import { useState } from "react"

import { WetInkMarquee } from "@/components/motion"
import { cn } from "@/lib/utils"

const DEFAULT_ITEMS = [
  "One venue QR",
  "28-day platform pilot",
  "No POS setup",
  "Fast at the counter",
]

/**
 * Riso-strip marquee — a dark ink band of scrolling mono microcopy. The value
 * props it repeats are also stated in body copy, so the STRIP is hidden from
 * assistive tech. Motion pauses under prefers-reduced-motion (globals.css).
 *
 * The pause control sits OUTSIDE the aria-hidden strip on purpose: auto-moving
 * content running longer than 5s needs an operable pause mechanism (WCAG
 * 2.2.2), and hover-only pause is neither keyboard- nor touch-operable. Putting
 * a focusable button inside an aria-hidden subtree would also be an ARIA
 * violation, so the band is hidden and the control is not.
 */
export function Marquee({
  items = DEFAULT_ITEMS,
  className,
}: {
  items?: string[]
  className?: string
}) {
  const [paused, setPaused] = useState(false)

  const strip = (
    <span className="flex shrink-0 items-center">
      {Array.from({ length: 4 }).flatMap((_, repeat) =>
        items.map((item, index) => (
          <span
            key={`${repeat}-${index}`}
            className="mono-meta flex items-center tracking-tag whitespace-nowrap"
          >
            {item}
            <span aria-hidden="true" className="px-4 text-primary">
              ✱
            </span>
          </span>
        ))
      )}
    </span>
  )

  return (
    <div
      className={cn(
        "relative isolate w-full max-w-full border-b-2 border-ink bg-ink text-paper",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="w-full max-w-full overflow-x-clip py-2 select-none"
      >
        <div className="relative w-full overflow-x-clip [contain:inline-size]">
          <WetInkMarquee paused={paused} className="flex w-max">
            {strip}
            {strip}
          </WetInkMarquee>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused((wasPaused) => !wasPaused)}
        className="focus-ring mono-id tap-floor absolute inset-y-0 right-1 inline-flex min-h-11 items-center rounded-(--radius-md) px-2 text-paper/70 uppercase hover:text-paper"
      >
        {paused ? "Play" : "Pause"}
      </button>
    </div>
  )
}
