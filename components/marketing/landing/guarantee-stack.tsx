import { Eyebrow, MonoTag, ReceiptCard } from "@/components/brand"
import { Section } from "@/components/layout"
import {
  CLAIMS_BOUNDARY,
  DFY_LAUNCH,
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
    <Section id="guarantees">
      <div className="max-w-2xl">
        <Eyebrow>Our guarantees</Eyebrow>
        <h2 className="mt-3 text-4xl leading-[0.95] font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-7xl">
          Two guarantees behind your launch
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground lg:text-xl">
          {OFFER.riskFraming}
        </p>
      </div>
      <div className="grid gap-6 pt-10 sm:pt-12 lg:grid-cols-2 lg:gap-8">
        {guarantees.map((guarantee) => (
          <ReceiptCard
            key={guarantee.name}
            edge
            padding="lg"
            className="h-full gap-4"
          >
            <MonoTag tone="leaf" className="justify-self-start">
              {guarantee.name}
            </MonoTag>
            <p className="text-2xl leading-snug font-extrabold tracking-tight text-foreground lg:text-3xl">
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
      <div className="mt-10 grid gap-4 rounded-(--radius-sheet) border-2 border-dashed border-line-strong bg-card p-8 sm:mt-12 lg:p-12">
        <p className="mono-meta text-foreground">The catch</p>
        <p className="text-2xl leading-snug font-extrabold tracking-tight text-foreground lg:text-3xl">
          {CLAIMS_BOUNDARY.never}
        </p>
        <div className="grid gap-6 text-sm leading-6 text-muted-foreground lg:grid-cols-3 lg:text-base">
          <p>{CLAIMS_BOUNDARY.guarantee}</p>
          <p>{CLAIMS_BOUNDARY.yourPart}</p>
          <p>{DFY_LAUNCH.intro}</p>
        </div>
      </div>
    </Section>
  )
}
