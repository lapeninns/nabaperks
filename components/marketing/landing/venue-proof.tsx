import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"

import { VENUE_PROOF_POOL_SIZE, DEFAULT_VENUE_PROOF_INDICES } from "./venue-proof-data"
import { VenueProofReviews } from "./venue-proof-reviews"

export function VenueProof() {
  return (
    <Section aria-labelledby="venue-proof-heading" size="compact">
      <div className="grid gap-4 sm:gap-5 md:gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div className="min-w-0">
          <MonoTag tone="leaf">What venues say</MonoTag>
          <h2
            id="venue-proof-heading"
            className="mt-2 max-w-[28ch] text-[clamp(1.45rem,2.8vw,2rem)] leading-[1.05] font-extrabold text-balance sm:max-w-[32ch] xl:max-w-[20ch]"
          >
            Pubs and cafes already on the counter.
          </h2>
          <p className="mt-2 max-w-[40ch] text-sm leading-6 text-muted-foreground sm:max-w-[48ch] xl:max-w-[40ch]">
            Real words from food and drink venues using Nabaperks at the till.
          </p>
          <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2 font-mono text-[0.64rem] tracking-[0.06em] uppercase sm:gap-x-6">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Venues quoted</dt>
              <dd className="text-base leading-none font-extrabold tabular-nums text-foreground">
                {VENUE_PROOF_POOL_SIZE}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Sector</dt>
              <dd className="font-bold text-foreground">Food &amp; drink</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0">
          <VenueProofReviews initialIndices={DEFAULT_VENUE_PROOF_INDICES} />
        </div>
      </div>
    </Section>
  )
}
