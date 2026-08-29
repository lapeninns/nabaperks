import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { WetInkRise } from "@/components/motion"
import { cn } from "@/lib/utils"

import {
  MARKETING_ANCHOR_OFFSET,
  MARKETING_GUTTER,
  SECTION_PAD,
} from "./section"

/**
 * ContrastBand — full-bleed inverted ink/paper band (the marquee's palette, so
 * it stays legible in either theme) used for the "how it works" and anti-fraud
 * sections. Replaces the hand-rolled outer `<section>` + inner container pair.
 *
 * Deliberately carries NO vertical margin: the 2px ink border plus the
 * neighbouring sections' own padding provide the separation, which removes the
 * single biggest source of dead vertical space (the old `my-14 sm:my-20`
 * stacking on top of adjacent `py-*`). `className` extends the outer band;
 * `containerClassName` extends the inner width-constrained container. `entrance`
 * defaults on and animates only the inner container, keeping the ink band fixed.
 * Server component.
 */
type BandSize = "default" | "dense" | "compact"

/**
 * The band is a peer section that happens to be inked, not a chapter break, so
 * it takes `Section`'s rhythm verbatim rather than keeping a parallel copy.
 * Importing SECTION_PAD means the two can no longer diverge (they already had:
 * the band used to pad 1.5-2x its neighbours, which is how two ink bands cost
 * ~140px of pure padding).
 */
const innerPad: Record<BandSize, string> = {
  default: SECTION_PAD.default,
  dense: SECTION_PAD.dense,
  compact: SECTION_PAD.compact,
}

type ContrastBandProps = {
  size?: BandSize
  containerClassName?: string
  entrance?: boolean
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<"section">, "children">

export function ContrastBand({
  size = "default",
  className,
  containerClassName,
  entrance = true,
  children,
  ...props
}: ContrastBandProps) {
  const innerClassName = cn(
    "mx-auto w-full max-w-marketing",
    MARKETING_GUTTER,
    innerPad[size],
    containerClassName
  )

  return (
    <section
      className={cn(
        MARKETING_ANCHOR_OFFSET,
        "border-y-2 border-ink bg-ink text-paper",
        className
      )}
      {...props}
    >
      {entrance ? (
        <WetInkRise as="div" inView distance={12} className={innerClassName}>
          {children}
        </WetInkRise>
      ) : (
        <div className={innerClassName}>{children}</div>
      )}
    </section>
  )
}
