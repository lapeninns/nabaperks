import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { WetInkRise } from "@/components/motion"
import { cn } from "@/lib/utils"

/**
 * Section — the single owner of marketing vertical rhythm + container width.
 *
 * Every public marketing section funnels its outer wrapper through here so the
 * page's density is tunable from one place (was a per-file `py-12 sm:py-16`
 * scattered across ~16 components). `MARKETING_ANCHOR_OFFSET` is always on so
 * JumpNav / hero anchors clear the sticky header (including the mobile link
 * rail). Pass `className` to extend or override —
 * it merges last via `cn`, so a caller can swap in its own grid/padding (e.g.
 * the hero's two-column grid). `entrance` defaults on so marketing sections
 * rise independently as they enter the viewport; opt out for sticky chrome.
 * Server component.
 */
type SectionSize = "default" | "dense" | "compact" | "tight" | "flush"
type SectionWidth = "marketing" | "narrow"

/**
 * The single anchor offset for the public marketing surface. The sticky header
 * is ~68px tall from `md:` up; below that it also carries the mobile link rail
 * (~53px), so a `#hash` jump needs to clear ~121px. Every marketing anchor
 * target imports this rather than picking its own `scroll-mt-*`, which is how
 * `/#pricing`, `#options` and the guide sections used to land at three
 * different offsets.
 */
export const MARKETING_ANCHOR_OFFSET = "scroll-mt-32 md:scroll-mt-24"

/** The one marketing gutter: chrome, content bands and the ink band share it. */
export const MARKETING_GUTTER = "px-6 lg:px-8"

/**
 * Monotonic at BOTH breakpoints — every step down is smaller on a phone and on
 * a desktop, so `dense` always compresses relative to `default` and `compact`
 * always compresses relative to `dense`. (The previous scale aliased
 * `default`/`dense` from `sm:` up and `dense`/`compact` below it, so half the
 * tokens were no-ops at whichever breakpoint the author was looking at.)
 */
const sizePad: Record<SectionSize, string> = {
  default: "py-6 sm:py-12",
  dense: "py-4 sm:py-8",
  compact: "py-3 sm:py-5",
  tight: "py-2 sm:py-3",
  flush: "py-0",
}

const widthMax: Record<SectionWidth, string> = {
  marketing: "max-w-marketing",
  narrow: "max-w-3xl",
}

type SectionProps = {
  as?: "section" | "div"
  size?: SectionSize
  width?: SectionWidth
  entrance?: boolean
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<"section">, "children">

export function Section({
  as: Tag = "section",
  size = "default",
  width = "marketing",
  entrance = true,
  className,
  children,
  ...props
}: SectionProps) {
  const sectionClassName = cn(
    "mx-auto w-full",
    MARKETING_ANCHOR_OFFSET,
    MARKETING_GUTTER,
    widthMax[width],
    sizePad[size],
    className
  )

  if (entrance) {
    return (
      <WetInkRise
        as={Tag}
        inView
        distance={12}
        className={sectionClassName}
        {...props}
      >
        {children}
      </WetInkRise>
    )
  }

  return (
    <Tag className={sectionClassName} {...props}>
      {children}
    </Tag>
  )
}
