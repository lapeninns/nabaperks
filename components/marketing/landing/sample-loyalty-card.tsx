import type { ReactNode } from "react"

import { VenueMark } from "@/components/brand"
import { StampGrid } from "@/components/loyalty"
import { cn } from "@/lib/utils"

type SampleLoyaltyCardProps = {
  /** Mono eyebrow — the venue line, e.g. "The Old Crown · Bristol". */
  venue: string
  /** The reward headline, e.g. "A free hot drink" once revealed. */
  title: ReactNode
  venueInitials: string
  stamps: {
    current: number
    total: number
    dates?: string[]
  }
  /** Fire the stamp slam animation on this slot index (decorative loops). */
  slamIndex?: number
  /** Tighten the stamp row to ~36px slots with day-only dates. Use on dense
   * cards (5+ stamps) so rotated dates don't clip against the circular edge. */
  compactStamps?: boolean
  /** The slot between the stamp row and the footer (QR + seal, or the demo). */
  children: ReactNode
  /** Mono card number, e.g. "Card Nº OC-0248". Omit both to hide the footer. */
  footerLeft?: ReactNode
  /** Mono status, fully styled by the caller so it can carry a spot ink. */
  footerRight?: ReactNode
  /** Reserved title block classes — keeps the hero loop from shifting layout. */
  titleBlockClassName?: string
  /** Extra classes on the body slot — e.g. a min-height to hold the seal demo. */
  bodyClassName?: string
  /** Reserved shell classes — keeps the hero loop from shifting the card face. */
  shellClassName?: string
  /** Tilt/animation classes on the outer wrapper that carries the drop shadow. */
  className?: string
  /** Hero lays stamps inline with QR and seal — hide the default stamp row. */
  hideStampRow?: boolean
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
  slamIndex = -1,
  compactStamps = false,
  children,
  footerLeft,
  footerRight,
  titleBlockClassName,
  bodyClassName,
  shellClassName,
  className,
  hideStampRow = false,
}: SampleLoyaltyCardProps) {
  const showFooter = footerLeft != null || footerRight != null

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[21rem] [filter:drop-shadow(4px_4px_0_var(--w-shadow-color))]",
        className
      )}
    >
      <div
        className={cn(
          "rounded-t-[var(--radius)] border-2 border-b-0 border-ink bg-card px-5 pt-5 pb-4",
          shellClassName
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mono-meta font-normal text-muted-foreground">
              {venue}
            </p>
            <div
              className={cn(
                "mt-1.5 text-lg leading-tight font-extrabold text-balance sm:text-xl",
                titleBlockClassName
              )}
            >
              {title}
            </div>
          </div>
          <VenueMark initials={venueInitials} size={50} className="shrink-0" />
        </div>

        <hr className="w-rule" />

        {hideStampRow ? null : (
          <>
            <StampGrid
              current={stamps.current}
              total={stamps.total}
              dates={stamps.dates}
              slamIndex={slamIndex}
              venueInitials={venueInitials}
              compact={compactStamps}
              className="min-h-11"
            />

            <hr className="w-rule" />
          </>
        )}

        <div className={cn("min-h-0", bodyClassName)}>{children}</div>

        {showFooter ? (
          <>
            <hr className="w-rule" />

            <div className="mono-id flex items-center justify-between gap-3 font-normal">
              <span className="text-muted-foreground">{footerLeft}</span>
              <span className="min-w-[9.75rem] text-right">{footerRight}</span>
            </div>
          </>
        ) : null}
      </div>
      <div aria-hidden="true" className="receipt-edge" />
    </div>
  )
}
