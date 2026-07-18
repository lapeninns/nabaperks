import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import {
  CLAIMS_BOUNDARY,
  GUARANTEE,
  GUARANTEE_ROI,
  OFFER,
} from "@/lib/marketing/facts"

/**
 * The guarantee stack plus the claims boundary. The boundary is rendered as
 * prominently as the guarantees — the offer's honesty is part of the offer.
 */
export function GuaranteeStack() {
  const guarantees = [
    {
      name: GUARANTEE.name,
      line: GUARANTEE.line,
      support: `${GUARANTEE.applies} ${GUARANTEE.claim}`,
      conditions: GUARANTEE.conditions,
    },
    {
      name: GUARANTEE_ROI.name,
      line: GUARANTEE_ROI.line,
      support: `${GUARANTEE_ROI.mechanic} ${GUARANTEE_ROI.claim}`,
      conditions: GUARANTEE_ROI.conditions,
    },
  ]

  return (
    <Section id="guarantees">
      <SectionHeader
        eyebrow="The guarantee stack"
        title="Two guarantees, one honest boundary"
        description={OFFER.riskFraming}
      />
      <div className="grid gap-5 pt-6 lg:grid-cols-2">
        {guarantees.map((guarantee) => (
          <ReceiptCard
            key={guarantee.name}
            edge
            padding="md"
            className="h-full gap-3"
          >
            <MonoTag tone="leaf" className="justify-self-start">
              {guarantee.name}
            </MonoTag>
            <p className="text-lg leading-snug font-extrabold text-foreground">
              “{guarantee.line}”
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {guarantee.support}
            </p>
            <p className="border-t-2 border-dashed border-border pt-2 text-xs leading-5 text-muted-foreground">
              {guarantee.conditions}
            </p>
          </ReceiptCard>
        ))}
      </div>
      <div className="mt-6 grid gap-2 border-2 border-dashed border-line-strong bg-card p-5">
        <p className="mono-meta text-foreground">
          The claims boundary — read it before you buy
        </p>
        <p className="text-sm leading-6 font-bold text-foreground">
          {CLAIMS_BOUNDARY.never}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {CLAIMS_BOUNDARY.guarantee}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {CLAIMS_BOUNDARY.yourPart}
        </p>
      </div>
    </Section>
  )
}
