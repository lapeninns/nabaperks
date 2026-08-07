import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { ContrastBand } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { SCARCITY, URGENCY } from "@/lib/marketing/facts"

/**
 * Honest scarcity and urgency: the real 5-a-week onboarding cap, the physical
 * print-batch cutoff.
 * Capacity is stated as policy, never rendered as an invented live counter.
 */
export function ScarcityBand() {
  return (
    // `--w-shadow-color` -> paper: the CTA's ink offset shadow is invisible
    // on the ink ground, which silently removes the press choreography from
    // one of the two highest-intent buttons on the surface.
    <ContrastBand
      id="capacity"
      size="dense"
      className="[--w-shadow-color:var(--w-paper)]"
    >
      <div className="grid gap-5 sm:gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-10 lg:gap-12">
        <div className="grid content-start gap-3">
          <p className="mono-meta text-paper/70">
            Why there’s sometimes a wait
          </p>
          <h2 className="text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
            {SCARCITY.capLine} — {SCARCITY.capReason}
          </h2>
          <p className="max-w-xl text-sm leading-6 text-paper/80">
            {SCARCITY.fullWeek}
          </p>
          <p className="max-w-xl text-sm leading-6 text-paper/80">
            {SCARCITY.honesty}
          </p>
        </div>
        <div className="grid content-start gap-4">
          <div className="grid gap-2 border-2 border-dashed border-paper/40 p-4">
            <p className="mono-meta text-paper/70">Why this week matters</p>
            <p className="text-sm leading-6 text-paper">{URGENCY.printBatch}</p>
          </div>
          <Button asChild size="lg" className="justify-self-start">
            <MarketingSignupLink>Start your launch</MarketingSignupLink>
          </Button>
        </div>
      </div>
    </ContrastBand>
  )
}
