import { WetInkMarquee } from "@/components/motion"
import { cn } from "@/lib/utils"

const DEFAULT_ITEMS = [
  "One venue QR",
  "28-day platform pilot",
  "No POS setup",
  "Fast at the counter",
]

/**
 * Riso-strip marquee — a dark ink band of scrolling mono microcopy. Decorative:
 * the value props it repeats are also stated in body copy, so it is hidden from
 * assistive tech. Motion pauses under prefers-reduced-motion (globals.css).
 */
export function Marquee({
  items = DEFAULT_ITEMS,
  className,
}: {
  items?: string[]
  className?: string
}) {
  const strip = (
    <span className="flex shrink-0 items-center">
      {Array.from({ length: 4 }).flatMap((_, repeat) =>
        items.map((item, index) => (
          <span
            key={`${repeat}-${index}`}
            className="mono-meta flex items-center tracking-[0.12em] whitespace-nowrap"
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
      aria-hidden="true"
      className={cn(
        "isolate w-full max-w-full overflow-x-clip border-b-2 border-ink bg-ink py-2 text-paper select-none",
        className
      )}
    >
      <div
        data-decorative-overflow="marquee"
        className="relative w-full overflow-x-clip [contain:inline-size]"
      >
        <WetInkMarquee className="flex w-max">
          {strip}
          {strip}
        </WetInkMarquee>
      </div>
    </div>
  )
}
