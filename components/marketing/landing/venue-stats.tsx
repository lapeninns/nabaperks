import { MonoTag } from "@/components/brand"

import { venueStats, venueStatsReady } from "./proof-config"

/**
 * Real network stats — first-party "we found" data (the SEO playbook's most
 * AI-citable asset) and the ROI answer skeptical owners want. Renders only when
 * every figure in proof-config.ts is real; ships nothing while placeholders
 * remain, so no invented number can leak to production.
 */
export function VenueStats() {
  if (!venueStatsReady()) return null

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-12">
      <div className="surface-card px-6 py-8 sm:px-10 sm:py-10">
        <MonoTag tone="leaf">Across the network</MonoTag>
        <dl className="mt-6 grid gap-8 sm:grid-cols-3">
          {venueStats.map((stat) => (
            <div key={stat.label}>
              <dd className="text-[clamp(2.5rem,6vw,3.75rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
                {stat.value}
              </dd>
              <dt className="mt-2 font-mono text-[0.72rem] font-bold tracking-[0.06em] text-foreground uppercase">
                {stat.label}
              </dt>
              {stat.helper ? (
                <p className="mt-1.5 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
                  {stat.helper}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
