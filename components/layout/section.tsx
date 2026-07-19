import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { WetInkRise } from "@/components/motion"
import { cn } from "@/lib/utils"

/**
 * Section — the single owner of marketing vertical rhythm + container width.
 *
 * Every public marketing section funnels its outer wrapper through here so the
 * page's density is tunable from one place (was a per-file `py-12 sm:py-16`
 * scattered across ~16 components). `scroll-mt-24` is always on so JumpNav /
 * hero anchors clear the sticky header. Pass `className` to extend or override —
 * it merges last via `cn`, so a caller can swap in its own grid/padding (e.g.
 * the hero's two-column grid). `entrance` defaults on so marketing sections
 * rise independently as they enter the viewport; opt out for sticky chrome.
 * Server component.
 */
type SectionSize = "default" | "dense" | "compact" | "tight" | "flush"
type SectionWidth = "marketing" | "narrow"

const sizePad: Record<SectionSize, string> = {
  default: "py-7 sm:py-10",
  /** Mobile-dense: compact phone rhythm, default desktop rhythm. */
  dense: "py-4 sm:py-10",
  compact: "py-4 sm:py-5",
  tight: "py-3 sm:py-4",
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
    "mx-auto w-full scroll-mt-24 px-6",
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
