import { MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import {
  BRAND,
  CLAIMS_BOUNDARY,
  PRODUCT,
  SCARCITY,
} from "@/lib/marketing/facts"

/**
 * Evidence the supplied offer pack can support without testimonials, revenue
 * figures or venue-count claims. Each item is a delivery fact or a transparent
 * boundary that the rest of the page expands below.
 */
export function ProofStrip() {
  const proof = [
    {
      label: "Independent pubs",
      value: BRAND.pointOfView,
    },
    {
      label: "Customer journey",
      value: `${PRODUCT.term} — no app or wallet pass`,
    },
    {
      label: "Measurement",
      value: "Return visits shown in your dashboard",
    },
    {
      label: "Honest limit",
      value: `${SCARCITY.capLine}; ${CLAIMS_BOUNDARY.never.toLowerCase()}`,
    },
  ] as const

  return (
    <Section id="proof" size="compact">
      <SectionHeader
        size="band"
        eyebrow="What you can check"
        title="A visible launch, measurable returns and clear limits"
        description="No anonymous testimonials or invented revenue figures — just the delivery, measurement and conditions behind the offer."
      />
      <ul className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        {proof.map((item) => (
          <li
            key={item.label}
            className="grid content-start gap-2 border-t-2 border-ink pt-3"
          >
            <MonoTag className="justify-self-start">{item.label}</MonoTag>
            <span className="text-sm leading-6 font-bold text-foreground">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
