import { MonoTag } from "@/components/brand"

import {
  NABAPERKS_PROOF_AS_OF,
  NABAPERKS_PROOF_HEADLINE,
  NABAPERKS_PROOF_INTRO,
  NABAPERKS_PROOF_NOTE,
  NABAPERKS_PROOF_TAG,
  nabaperksProofReady,
  nabaperksStats,
} from "./nabaperks-proof-data"

/**
 * Nabaperks loyalty proof band — real figures (members, recent activity,
 * redemptions, repeat rate) from venues running the programme.
 */
export function NabaperksProof() {
  if (!nabaperksProofReady()) return null

  return (
    <section
      id="nabaperks-proof"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-10 sm:py-12"
    >
      <div className="surface-card px-6 py-8 sm:px-10 sm:py-10">
        <MonoTag tone="leaf">{NABAPERKS_PROOF_TAG}</MonoTag>
        <h2 className="mt-4 max-w-[34ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
          {NABAPERKS_PROOF_HEADLINE}
        </h2>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-pretty text-muted-foreground">
          {NABAPERKS_PROOF_INTRO} As of {NABAPERKS_PROOF_AS_OF}.
        </p>

        <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {nabaperksStats.map((stat) => (
            <div key={stat.label}>
              <dd className="text-[clamp(2.25rem,5vw,3.25rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
                {stat.value}
              </dd>
              <dt className="mt-2 font-mono text-[0.72rem] font-bold tracking-[0.06em] text-foreground uppercase">
                {stat.label}
              </dt>
              {stat.helper ? (
                <p className="mt-1.5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
                  {stat.helper}
                </p>
              ) : null}
            </div>
          ))}
        </dl>

        <p className="mt-8 max-w-[64ch] border-t-2 border-dashed border-border pt-5 text-sm leading-relaxed font-semibold text-pretty">
          {NABAPERKS_PROOF_NOTE}
        </p>
      </div>
    </section>
  )
}
