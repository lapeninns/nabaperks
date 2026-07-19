import { MonoTag, ReceiptCard, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
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
        title="Two guarantees behind your pilot"
        description={OFFER.riskFraming}
      />
      <div className="grid gap-4 pt-5 sm:gap-5 sm:pt-6 lg:grid-cols-2">
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
            <details className="group border-t-2 border-dashed border-border">
              <summary className="focus-ring mono-id flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
                How it works — and the conditions
                <span aria-hidden="true" className="group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="hidden group-open:inline">
                  −
                </span>
              </summary>
              <p className="text-sm leading-6 text-muted-foreground">
                {guarantee.support}
              </p>
              <p className="pt-2 pb-2 text-xs leading-5 text-muted-foreground">
                {guarantee.conditions}
              </p>
            </details>
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
