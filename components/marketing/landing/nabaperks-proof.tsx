import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { PROOF, PROOF_DISPLAY } from "@/lib/marketing/facts"

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
 * Nabaperks loyalty proof band — the first-party proof as a named, citable data
 * asset (the "Nabaperks Counter-Loyalty Index"). Carries a key-stat callout, the
 * figure grid, a copy-paste-ready snippet for answer engines, and the approved
 * methodology — all from the single fixed June 2026 snapshot in facts.ts.
 */
export function NabaperksProof() {
  if (!nabaperksProofReady()) return null

  return (
    <Section id="nabaperks-proof" size="compact">
      <div className="surface-card px-6 py-8 sm:px-10 sm:py-10">
        <MonoTag tone="leaf">{NABAPERKS_PROOF_TAG}</MonoTag>
        <h2 className="mt-4 max-w-[34ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
          {NABAPERKS_PROOF_HEADLINE}
        </h2>
        <p className="mono-meta mt-2 tracking-[0.08em] text-primary">
          {PROOF.indexName} · {NABAPERKS_PROOF_AS_OF}
        </p>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-pretty text-muted-foreground">
          {NABAPERKS_PROOF_INTRO}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
          {nabaperksStats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <dt className="mono-meta order-2 mt-2 text-foreground">
                {stat.label}
              </dt>
              <dd className="order-1 text-[clamp(2.25rem,5vw,3.25rem)] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
                {stat.value}
              </dd>
              {stat.helper ? (
                <dd className="order-3 mt-1.5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
                  {stat.helper}
                </dd>
              ) : null}
            </div>
          ))}
        </dl>

        {/* Copy-paste-ready citable snippet (PDF: AI-citable snippets) */}
        <blockquote className="mt-7 border-l-2 border-ink bg-secondary px-5 py-4 text-[0.95rem] leading-relaxed text-pretty">
          In the {PROOF.indexName} (snapshot {NABAPERKS_PROOF_AS_OF}),{" "}
          <strong className="font-bold text-foreground">
            {PROOF_DISPLAY.repeatRate}
          </strong>{" "}
          of {PROOF_DISPLAY.members} loyalty members returned, and{" "}
          {PROOF_DISPLAY.rewardsRedeemed} of {PROOF_DISPLAY.rewardsEarned} rewards
          were redeemed. {PROOF.calculatedFrom} {PROOF.measuredAcross}
        </blockquote>

        <p className="mt-5 max-w-[64ch] border-t-2 border-dashed border-border pt-5 text-sm leading-relaxed font-semibold text-pretty">
          {NABAPERKS_PROOF_NOTE}
        </p>
      </div>
    </Section>
  )
}
