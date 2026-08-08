import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { getPublishedCommercialEvidence } from "@/lib/marketing/commercial-evidence"

const proofDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export async function CommercialEvidenceProof() {
  const cases = await getPublishedCommercialEvidence()

  if (!cases.length) return null

  return (
    <Section id="merchant-evidence" size="compact">
      <SectionHeader
        size="band"
        eyebrow="Approved merchant evidence"
        title="Results tied back to the loyalty ledger"
        description="Each figure is a dated aggregate snapshot. Nothing appears here without the venue’s recorded approval."
      />
      <div className="grid gap-4 pt-5 sm:grid-cols-2 md:grid-cols-3">
        {cases.map((caseStudy) => (
          <ReceiptCard key={caseStudy.id} edge padding="md" className="gap-3">
            <MonoTag tone="leaf" className="justify-self-start">
              {caseStudy.attributionName}
            </MonoTag>
            {caseStudy.testimonialQuote ? (
              <blockquote className="text-lg leading-snug font-extrabold text-foreground">
                “{caseStudy.testimonialQuote}”
              </blockquote>
            ) : null}
            <p className="text-sm leading-6 text-muted-foreground">
              {caseStudy.afterSummary}
            </p>
            <dl className="grid grid-cols-3 gap-2 border-t-2 border-dashed border-border pt-3 text-center">
              <EvidenceMetric
                label="New members"
                value={caseStudy.newMembers}
              />
              <EvidenceMetric
                label="Return visits"
                value={caseStudy.verifiedReturnVisits}
              />
              <EvidenceMetric
                label="Rewards used"
                value={caseStudy.rewardsRedeemed}
              />
            </dl>
            <p className="mono-id text-muted-foreground uppercase">
              {formatDate(caseStudy.measurementStart)}–
              {formatDate(caseStudy.measurementEnd)} · verified returns v1 ·
              snapshot {formatDate(caseStudy.snapshotAt)}
            </p>
          </ReceiptCard>
        ))}
      </div>
    </Section>
  )
}

function EvidenceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
      <dd className="numeric-tabular text-xl font-extrabold text-foreground">
        {value}
      </dd>
    </div>
  )
}

function formatDate(value: string) {
  return proofDate.format(
    new Date(value.includes("T") ? value : `${value}T12:00:00Z`)
  )
}
