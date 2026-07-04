import { MonoTag } from "@/components/brand"

import { VENUE_PROOF_POOL_SIZE, DEFAULT_VENUE_PROOF_INDICES } from "./venue-proof-data"
import { VenueProofReviews } from "./venue-proof-reviews"

/**
 * Named-venue operator voice. Renders as a panel body inside the landing's
 * merged proof section (the `#venue-proof` anchor lives on the panel wrapper
 * there; heading is h3 under the section's shared h2).
 */
export function VenueProof() {
  return (
    <div aria-labelledby="venue-proof-heading">
      <div className="grid gap-4 sm:gap-5 md:gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div className="min-w-0">
          <MonoTag tone="leaf">What venues say</MonoTag>
          <h3
            id="venue-proof-heading"
            className="mt-2 max-w-[28ch] text-[clamp(1.45rem,2.8vw,2rem)] leading-[1.05] font-extrabold text-balance sm:max-w-[32ch] xl:max-w-[20ch]"
          >
            Pubs and cafes already on the counter.
          </h3>
          <p className="mt-2 max-w-[40ch] text-sm leading-6 text-muted-foreground sm:max-w-[48ch] xl:max-w-[40ch]">
            Named venues from the Lapen Inns network, with paraphrased operator
            voice rather than verbatim testimonials.
          </p>
          <dl className="mono-id mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2 font-normal sm:gap-x-6">
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
    </div>
  )
}
