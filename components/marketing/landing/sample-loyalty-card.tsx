import type { ReactNode } from "react"

import { VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty"
import { cn } from "@/lib/utils"

type SampleLoyaltyCardProps = {
  /** Mono eyebrow — the venue line, e.g. "The Old Crown · Bristol". */
  venue: string
  /** The reward headline, e.g. "Free hot drink after 3 visits". */
  title: ReactNode
  venueInitials: string
  stamps: {
    current: number
    total: number
    dates?: string[]
  }
  /** The slot between the stamp row and the footer (QR + seal, or the demo). */
  children: ReactNode
  /** Mono card number, e.g. "Card Nº OC-0248". */
  footerLeft: ReactNode
  /** Mono status, fully styled by the caller so it can carry a spot ink. */
  footerRight: ReactNode
  /** Extra classes on the body slot — e.g. a min-height to hold the seal demo. */
  bodyClassName?: string
  /** Tilt/animation classes on the outer wrapper that carries the drop shadow. */
  className?: string
}

/**
 * The Nabaperks loyalty card, as a customer sees it — one object reused across
 * the landing page so the hero, the proof shape, and the reward reveal are the
 * *same* receipt in different states, not three lookalikes. Token-driven (warm
 * card surface, ink border, hard offset shadow that follows the perforated
 * zigzag edge) so it themes and inverts for dark mode for free.
 */
export function SampleLoyaltyCard({
  venue,
  title,
  venueInitials,
  stamps,
  children,
  footerLeft,
  footerRight,
  bodyClassName,
  className,
}: SampleLoyaltyCardProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[21rem] [filter:drop-shadow(4px_4px_0_var(--w-shadow-color))]",
        className
      )}
    >
      <div className="rounded-t-[var(--radius)] border-2 border-b-0 border-ink bg-card px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[0.7rem] tracking-[0.06em] text-muted-foreground uppercase">
              {venue}
            </p>
            <p className="mt-1.5 text-lg leading-tight font-extrabold text-balance sm:text-xl">
              {title}
            </p>
          </div>
          <VenueMark initials={venueInitials} size={50} className="shrink-0" />
        </div>

        <hr className="w-rule" />

        <StampGrid
          current={stamps.current}
          total={stamps.total}
          dates={stamps.dates}
          venueInitials={venueInitials}
        />

        <hr className="w-rule" />

        <div className={bodyClassName}>{children}</div>

        <hr className="w-rule" />

        <div className="flex items-center justify-between gap-3 font-mono text-[0.6rem] tracking-[0.06em] uppercase">
          <span className="text-muted-foreground">{footerLeft}</span>
          {footerRight}
        </div>
      </div>
      <div aria-hidden="true" className="receipt-edge" />
    </div>
  )
}
