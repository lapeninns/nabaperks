import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { MarketingDisclosure } from "@/components/marketing"
import {
  CLAIMS_BOUNDARY,
  GUARANTEE,
  GUARANTEE_ROI,
  OFFER,
} from "@/lib/marketing/facts"

/**
 * The two guarantees plus what they deliberately don't cover — rendered as
 * prominently as the guarantees themselves, because the honesty is part of
 * the offer. Each card's operator conditions sit behind a native disclosure
 * (one tap, always labelled); the promise line, its mechanics and the catch
 * stay fully visible.
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
    <Section id="guarantees" size="dense">
      <SectionHeader
        eyebrow="Our guarantees"
        title="Two guarantees behind your launch"
        description={OFFER.riskFraming}
      />
      <div className="grid gap-4 pt-5 sm:gap-5 sm:pt-6 md:grid-cols-2">
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
            {/* Flush with the card's own padding, so only the tear line
                separates the disclosure from the promise above it. */}
            <MarketingDisclosure
              className="border-t-2 border-dashed border-border"
              summary="How it works — and the conditions"
              summaryClassName="px-0"
              bodyClassName="px-0 pb-0"
            >
              <p className="text-sm leading-6 text-muted-foreground">
                {guarantee.support}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {guarantee.conditions}
              </p>
            </MarketingDisclosure>
          </ReceiptCard>
        ))}
      </div>
      <div className="mt-5 grid gap-2 border-2 border-dashed border-line-strong bg-card p-5 sm:mt-6">
        <p className="mono-meta text-foreground">The catch</p>
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
