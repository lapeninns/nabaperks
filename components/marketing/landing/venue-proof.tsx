import { MonoTag } from "@/components/brand"
import { OPERATOR } from "@/lib/marketing/facts"

import { VENUE_PROOF_POOL_SIZE, DEFAULT_VENUE_PROOF_INDICES } from "./venue-proof-data"
import { VenueProofReviews } from "./venue-proof-reviews"

/**
 * Named-venue pub team feedback. Renders as a panel body inside the landing's
 * merged proof section (the `#venue-proof` anchor lives on the panel wrapper
 * there; heading is h3 under the section's shared h2).
 */
export function VenueProof({
  headingLevel = "h3",
}: {
  headingLevel?: "h2" | "h3"
}) {
  const Heading = headingLevel

  return (
    <div aria-labelledby="venue-proof-heading">
      <div className="grid gap-4 sm:gap-5 md:gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div className="min-w-0">
          <MonoTag tone="leaf">Independent pub voices</MonoTag>
          <Heading
            id="venue-proof-heading"
            className="mt-2 max-w-[28ch] text-[clamp(1.45rem,2.8vw,2rem)] leading-[1.05] font-extrabold text-balance sm:max-w-[32ch] xl:max-w-[20ch]"
          >
            What 9 independent pubs say about Nabaperks.
          </Heading>
          <p className="mt-2 max-w-[40ch] text-sm leading-6 text-muted-foreground sm:max-w-[48ch] xl:max-w-[40ch]">
            Nabaperks is used by independent pubs across England — all nine
            run by {OPERATOR.name}, the operator behind Nabaperks. These
            quotes capture what their teams find useful in day-to-day service.
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
