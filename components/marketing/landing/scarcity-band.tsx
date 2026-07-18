import Link from "next/link"

import { ContrastBand } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { ROUTES, SCARCITY, URGENCY } from "@/lib/marketing/facts"
import type { ActivePromo } from "@/lib/marketing/promo"

/**
 * Honest scarcity and urgency: the real 5-a-week onboarding cap, the physical
 * print-batch cutoff, and the rolling monthly promo when one is live.
 * Capacity is stated as policy, never rendered as an invented live counter.
 */
export function ScarcityBand({ promo }: { promo: ActivePromo | null }) {
  return (
    <ContrastBand id="capacity">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="grid content-start gap-3">
          <p className="mono-meta text-paper/70">Real capacity, said plainly</p>
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
            {promo ? (
              <p className="border-t-2 border-dashed border-paper/40 pt-2 text-sm leading-6 text-paper/80">
                <span className="mono-id block pb-1 text-paper uppercase">
                  {promo.name} · ends {promo.deadlineLabel}
                </span>
                {promo.perk}
              </p>
            ) : null}
          </div>
          <Button asChild size="lg" className="justify-self-start">
            <Link href={ROUTES.signup}>Start your free pilot</Link>
          </Button>
        </div>
      </div>
    </ContrastBand>
  )
}
