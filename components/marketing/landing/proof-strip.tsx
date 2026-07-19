import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { OPERATOR, OPERATOR_ESTATE } from "@/lib/marketing/facts"

/**
 * First-party proof: the operator's real 9-pub estate. Deliberately the only
 * "proof" on the page — no invented stats, no invented testimonials. On phones
 * the estate packs into two name-only columns (postcodes surface from `sm` up)
 * so the trust signal doesn't cost half a screen of scrolling.
 */
export function ProofStrip() {
  return (
    <Section id="proof" size="compact">
      <SectionHeader
        eyebrow="Who's behind it"
        title="Built by a pub operator, not a software vendor"
        description={`Nabaperks is built and run by ${OPERATOR.name}, ${OPERATOR.estateLine}.`}
      />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-5 sm:gap-x-6 sm:gap-y-2 lg:grid-cols-3">
        {OPERATOR_ESTATE.map((pub) => (
          <li
            key={pub.postcode}
            className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-border pb-1.5 sm:pb-2"
          >
            <span className="text-xs font-bold text-foreground sm:text-sm">
              {pub.name}
            </span>
            <span className="mono-id hidden text-muted-foreground sm:inline">
              {pub.postcode}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
