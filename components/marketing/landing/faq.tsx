import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { MarketingDisclosure } from "@/components/marketing"
import { FAQ_ITEMS, type MarketingFaq } from "@/lib/marketing/facts"

/**
 * Bordered accordion FAQ (the marketing treatment sanctioned in DESIGN.md).
 * Renders the shared FAQ facts; pages pair it with `faqPageSchema` over the
 * same items so the JSON-LD can never drift from the visible copy.
 *
 * `numbered` is the only difference between the two renderings the surface
 * used to ship as two components — they had drifted to two elevations and two
 * answer indents for the same nine questions on pages a reader visits back to
 * back. The measure is capped here rather than at the call site, because the
 * pricing page stretched a 14px accordion across the full 1,152px marketing
 * column: the `+` a thousand pixels from its label, answers at ~155
 * characters a line.
 */
export function FaqList({
  items,
  numbered = false,
}: {
  items: readonly MarketingFaq[]
  /** Print the question index in mono (the /faq ledger treatment). */
  numbered?: boolean
}) {
  const Wrapper = numbered ? "ol" : "ul"

  return (
    <Wrapper className="mx-auto grid w-full max-w-3xl gap-3">
      {items.map((faq, index) => (
        <li key={faq.question}>
          <MarketingDisclosure
            className="surface-card-flat"
            summary={faq.question}
            summaryPrefix={
              numbered ? (
                <span
                  aria-hidden="true"
                  className="mono-id w-6 shrink-0 text-muted-foreground"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              ) : undefined
            }
          >
            <p className="max-w-[68ch] text-sm leading-6 text-muted-foreground">
              {faq.answer}
            </p>
          </MarketingDisclosure>
        </li>
      ))}
    </Wrapper>
  )
}

/**
 * The FAQ page's numbered ledger. One implementation, two names: the routes
 * are pinned by contract (tests/contracts/marketing-offer-source asserts
 * `<LandingFaq` on /faq and bans it everywhere else), the presentation is not.
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
    <div className="pt-5 sm:pt-6">
      <FaqList items={items} numbered />
    </div>
  )

  if (!showHeader) return list

  return (
    <Section id="faq" size="dense">
      <SectionHeader
        size="band"
        eyebrow="Good questions"
        title="Frequently asked questions"
      />
      {list}
    </Section>
  )
}
