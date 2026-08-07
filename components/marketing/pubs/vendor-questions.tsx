import { ReceiptCard } from "@/components/brand"
import { CLAIMS_BOUNDARY, PUB_VENDOR_QUESTIONS } from "@/lib/marketing/facts"

/**
 * The due-diligence list, with our own answers beside each question.
 *
 * Deliberately all-visible rather than an accordion: the whole point is that a
 * publican can read our answers in the same glance as the questions, and
 * collapsed answers read as something to hide. No `FAQPage` node ships from
 * here — `/faq` owns that schema, and two competing FAQPage graphs on one site
 * help nobody.
 *
 * The closing boundary is not decoration: the last answer names a guarantee, so
 * this surface states its limits in the same breath. Server component.
 */
export function VendorQuestions() {
  return (
    <div className="grid gap-4">
      <ol className="grid gap-0">
        {PUB_VENDOR_QUESTIONS.map((question, index) => (
          <li
            key={question.ask}
            className="grid gap-3 border-b-2 border-dashed border-border py-4 first:pt-0 last:border-b-0 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:gap-6"
          >
            <div className="grid content-start gap-1.5">
              <p className="mono-id text-primary uppercase">
                Question {index + 1}
              </p>
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {question.ask}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {question.why}
              </p>
            </div>
            <div className="surface-card-flat grid content-start gap-1.5 p-3.5">
              <p className="mono-id text-muted-foreground uppercase">
                Our answer
              </p>
              <p className="text-sm leading-6 text-foreground">
                {question.ourAnswer}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <ReceiptCard edge padding="md" className="gap-2">
        <p className="mono-meta text-muted-foreground">
          And the limit on that last one
        </p>
        <p className="text-base leading-7 font-extrabold text-foreground">
          {CLAIMS_BOUNDARY.never}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {CLAIMS_BOUNDARY.yourPart}
        </p>
      </ReceiptCard>
    </div>
  )
}
