import { MonoTag } from "@/components/brand"

import { VENUE_PROOF_POOL_SIZE } from "./venue-proof-data"
import { VenueProofReviews } from "./venue-proof-reviews"

export function VenueProof() {
  return (
    <section
      aria-labelledby="venue-proof-heading"
      className="mx-auto w-full max-w-6xl px-6 py-6 sm:py-8"
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-6">
        <div>
          <MonoTag tone="leaf">Venue voices</MonoTag>
          <h2
            id="venue-proof-heading"
            className="mt-2 max-w-[20ch] text-[clamp(1.45rem,2.8vw,2rem)] leading-[1.05] font-extrabold text-balance"
          >
            Pubs and cafes already on the counter.
          </h2>
          <p className="mt-2 max-w-[40ch] text-sm leading-6 text-muted-foreground">
            Food and drink venues running no-app loyalty with Nabaperks. Tap see
            more to shuffle another three operator notes from the network.
          </p>
          <dl className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[0.64rem] tracking-[0.06em] uppercase">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Venues live</dt>
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

        <VenueProofReviews />
      </div>
    </section>
  )
}
