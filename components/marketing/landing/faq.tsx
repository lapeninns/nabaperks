import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { FAQ_ITEMS, type MarketingFaq } from "@/lib/marketing/facts"

/**
 * Bordered accordion FAQ (the marketing treatment sanctioned in DESIGN.md).
 * Renders the shared FAQ facts; pages pair it with `faqPageSchema` over the
 * same items so the JSON-LD can never drift from the visible copy.
 */
export function FaqList({ items }: { items: readonly MarketingFaq[] }) {
  return (
    <div className="grid gap-3">
      {items.map((faq) => (
        <details
          key={faq.question}
          className="group rounded-lg border-2 border-ink bg-card"
        >
          <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
            {faq.question}
            <span
              aria-hidden="true"
              className="mono-meta text-muted-foreground group-open:hidden"
            >
              +
            </span>
            <span
              aria-hidden="true"
              className="mono-meta hidden text-muted-foreground group-open:inline"
            >
              −
            </span>
          </summary>
          <p className="border-t-2 border-dashed border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  )
}

export function LandingFaq({
  items = FAQ_ITEMS,
}: {
  items?: readonly MarketingFaq[]
}) {
  return (
    <Section id="faq">
      <SectionHeader
        eyebrow="Questions, answered straight"
        title="Frequently asked questions"
      />
      <div className="pt-6">
        <FaqList items={items} />
      </div>
    </Section>
  )
}
