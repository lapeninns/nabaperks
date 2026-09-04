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
          className="group overflow-hidden rounded-(--radius-sheet) border-2 border-ink bg-card shadow-sm"
        >
          <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-(--radius-sheet) px-5 py-5 text-base font-bold text-foreground lg:text-lg [&::-webkit-details-marker]:hidden">
            {faq.question}
            <span
              aria-hidden="true"
              className="mono-meta grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-secondary text-foreground group-open:bg-ink group-open:text-paper"
            >
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">−</span>
            </span>
          </summary>
          <p className="border-t-2 border-dashed border-border px-5 pb-6 text-base leading-7 text-muted-foreground lg:text-lg">
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  )
}

/**
 * The how-it-works FAQ as a numbered ledger of question cards: each question
 * carries its index in mono, opens on a dashed tear line, and the answer
 * aligns under the question text. Kept separate from `FaqList` (which the
 * pricing page renders) so this page's presentation can evolve on its own.
 */
export function LandingFaq({
  items = FAQ_ITEMS,
  showHeader = true,
}: {
  items?: readonly MarketingFaq[]
  /** When false, render only the numbered list (for a page that owns the h1). */
  showHeader?: boolean
}) {
  const list = (
    <ol className="mx-auto grid w-full max-w-3xl gap-3 pt-5 sm:pt-6">
      {items.map((faq, index) => (
        <li key={faq.question}>
          <details className="group rounded-lg border-2 border-ink bg-card shadow-sm">
            <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden="true"
                className="mono-id w-6 shrink-0 text-muted-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-foreground">
                {faq.question}
              </span>
              <span
                aria-hidden="true"
                className="mono-meta shrink-0 text-muted-foreground group-open:hidden"
              >
                +
              </span>
              <span
                aria-hidden="true"
                className="mono-meta hidden shrink-0 text-muted-foreground group-open:inline"
              >
                −
              </span>
            </summary>
            <p className="border-t-2 border-dashed border-border py-3 pr-4 pl-[3.25rem] text-sm leading-6 text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        </li>
      ))}
    </ol>
  )

  if (!showHeader) return list

  return (
    <Section id="faq" size="dense">
      <SectionHeader
        eyebrow="Good questions"
        title="Frequently asked questions"
      />
      {list}
    </Section>
  )
}
