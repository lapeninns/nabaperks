import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { WetInkRise } from "@/components/motion"

import { nabaperksProofReady } from "./nabaperks-proof-data"
import { NabaperksProofBody } from "./nabaperks-proof"
import { OldCrownCandidate, oldCrownCandidateReady } from "./old-crown-candidate"
import { ProofStrip } from "./proof-strip"
import { ProofTabs, type ProofTabPanel } from "./proof-tabs"
import { VenueProof } from "./venue-proof"

/**
 * LandingProof — the merged proof section: setup stat band (always visible)
 * plus the three proof bodies (live numbers, case study, pub voices) as
 * chip-switched panels below `lg` and a stacked sequence from `lg`.
 *
 * `entrance={false}` deliberately: at desktop this section spans several
 * viewports, so WetInkRise's `amount: 0.2` in-view threshold could never fire
 * on the whole Section — each block carries its own rise instead. Chip
 * visibility derives from the same gates as the panel bodies so a chip never
 * opens an empty panel.
 */
export function LandingProof() {
  const panels: ProofTabPanel[] = []

  if (nabaperksProofReady()) {
    panels.push({
      id: "nabaperks-proof",
      label: "Real numbers",
      content: (
        <WetInkRise as="div" inView distance={12}>
          <NabaperksProofBody headingLevel="h3" />
        </WetInkRise>
      ),
    })
  }

  if (oldCrownCandidateReady()) {
    panels.push({
      id: "old-crown",
      label: "Case study",
      content: (
        <WetInkRise as="div" inView distance={12}>
          <OldCrownCandidate />
        </WetInkRise>
      ),
    })
  }

  panels.push({
    id: "venue-proof",
    label: "What pubs say",
    content: (
      <WetInkRise as="div" inView distance={12}>
        <VenueProof />
      </WetInkRise>
    ),
  })

  return (
    <Section id="proof" size="compact" entrance={false}>
      <WetInkRise as="div" inView distance={12}>
        <MonoTag tone="leaf">Proof</MonoTag>
        <h2 className="mt-3 max-w-[26ch] text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance">
          Proof from the counter.
        </h2>
        <div className="mt-4 sm:mt-5">
          <ProofStrip />
        </div>
      </WetInkRise>

      <div className="mt-6">
        <ProofTabs panels={panels} label="Proof" />
      </div>
    </Section>
  )
}
