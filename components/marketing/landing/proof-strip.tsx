import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { OPERATOR, OPERATOR_ESTATE } from "@/lib/marketing/facts"

/**
 * First-party proof: the operator's real 9-pub estate, name and postcode.
 * Deliberately the only "proof" on the page — no invented stats, no invented
 * testimonials.
 */
export function ProofStrip() {
  return (
    <Section id="proof" size="compact">
      <SectionHeader
        eyebrow="Who's behind it"
        title="Built by a pub operator, not a software vendor"
        description={`Nabaperks is built and run by ${OPERATOR.name}, ${OPERATOR.estateLine}.`}
      />
      <ul className="grid gap-x-6 gap-y-2 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        {OPERATOR_ESTATE.map((pub) => (
          <li
            key={pub.postcode}
            className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-border pb-2"
          >
            <span className="text-sm font-bold text-foreground">
              {pub.name}
            </span>
            <span className="mono-id text-muted-foreground">
              {pub.postcode}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
