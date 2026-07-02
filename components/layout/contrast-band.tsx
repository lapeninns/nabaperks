import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * ContrastBand — full-bleed inverted ink/paper band (the marquee's palette, so
 * it stays legible in either theme) used for the "how it works" and anti-fraud
 * sections. Replaces the hand-rolled outer `<section>` + inner container pair.
 *
 * Deliberately carries NO vertical margin: the 2px ink border plus the
 * neighbouring sections' own padding provide the separation, which removes the
 * single biggest source of dead vertical space (the old `my-14 sm:my-20`
 * stacking on top of adjacent `py-*`). `className` extends the outer band;
 * `containerClassName` extends the inner width-constrained container. Server
 * component.
 */
type BandSize = "default" | "compact"

const innerPad: Record<BandSize, string> = {
  default: "py-9 sm:py-12",
  compact: "py-7 sm:py-9",
}

type ContrastBandProps = {
  size?: BandSize
  containerClassName?: string
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<"section">, "children">

export function ContrastBand({
  size = "default",
  className,
  containerClassName,
  children,
  ...props
}: ContrastBandProps) {
  return (
    <section
      className={cn(
        "scroll-mt-24 border-y-2 border-ink bg-ink text-paper",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-marketing px-6",
          innerPad[size],
          containerClassName
        )}
      >
        {children}
      </div>
    </section>
  )
}
