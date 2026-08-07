import { Section } from "@/components/layout"
import { BRAND, PRODUCT, SCARCITY } from "@/lib/marketing/facts"

/**
 * A bare fact row — deliberately headerless. Every band on the old landing
 * opened with an eyebrow + title + description; this one states four checkable
 * facts and gets out of the way.
 *
 * The facts are full clauses, so the old wrapped `flex` row set them as four
 * bold sentences 8px apart inside one ink box — a run-on paragraph in bold on
 * any phone, and a layout that only worked past 1024px where all four fit on
 * one line. They are now a printed ledger: a mono index per fact, dashed rules
 * between them on a phone, two-up from `sm:` and four-up from `lg:`.
 */
export function ProofLine() {
  const facts = [
    BRAND.pointOfView,
    `A ${PRODUCT.term} — no app to download`,
    "Return visits shown in your dashboard",
    SCARCITY.capLine,
  ] as const

  return (
    <Section id="proof" size="compact">
      <ul className="grid gap-4 border-y-2 border-ink py-4 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
        {facts.map((fact, index) => (
          <li
            key={fact}
            className="grid content-start gap-1 max-sm:border-t-2 max-sm:border-dashed max-sm:border-border max-sm:pt-4 max-sm:first:border-t-0 max-sm:first:pt-0"
          >
            <span aria-hidden="true" className="mono-id text-primary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm leading-6 font-bold text-foreground">
              {fact}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
