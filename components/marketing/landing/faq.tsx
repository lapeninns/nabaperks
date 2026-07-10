import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"
import { PRODUCT } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

export type Faq = { q: string; a: string }

/**
 * The honest answers — mirrors the real SERP "People Also Ask" fears so each Q&A
 * doubles as FAQPage JSON-LD and AI-answer bait. Exported so the page can emit
 * schema from this exact array (visible copy === structured data). Each answer is
 * self-contained and quotable in 1–2 sentences for answer engines.
 */
export const faqs: readonly Faq[] = [
  {
    q: "Do my customers have to download an app?",
    a: "No — and no wallet pass either. Customers scan your till QR and the card opens straight in their phone browser. It works on any iPhone or Android with nothing to download or install.",
  },
  {
    q: "Can staff or customers fake the stamps?",
    a: "Customers claim from your venue QR on their own phones. Nabaperks reduces misuse rather than claiming it is impossible: each claim is linked to their saved membership and your live programme, capped at one stamp per UK date; optional location checks flag unusual claims, and staff scan the live reward code when it is collected.",
  },
  {
    q: "What if a customer loses or changes their phone — do they lose their stamps?",
    a: "They don't lose anything. Stamps stay on their account — not on a losable card or a single phone. They sign back in on a new device and everything is still there.",
  },
  {
    q: "Do I need a POS, till integration or special hardware?",
    a: "No POS, no integration, no special hardware. It runs on any phone, tablet or till, including cash-only takeaways, with one permanent venue QR for customers to scan.",
  },
  {
    q: "How much does it cost, and am I tied into a contract?",
    a: `A 30-day free pilot, then £49/month per venue, with no contract. ${PRODUCT.cancelLine}`,
  },
  {
    q: "Can I try it before I pay?",
    a: `Yes. You can preview the QR flow during the 30-day pilot. ${PRODUCT.cancelLine}`,
  },
  {
    q: "Will it spam my customers, and is their data safe?",
    a: "No spam: loyalty and marketing are kept separate, so customers earn and redeem without joining any marketing list. Their data stays with your venue, with marketing kept consent-led and plain-English Privacy and Terms.",
  },
  {
    q: "How is this different from a paper card or apps like Stamp Me?",
    a: "It keeps what customers like about a paper card — simple, scan-and-collect, no app — but the card stays on their account and each claim leaves a venue-linked record. Unlike wallet-pass apps such as Stamp Me or Loopy Loyalty, there is nothing to install. You also get a weekly digest of visits and redemptions a paper card cannot provide.",
  },
]

/**
 * The one FAQ face — native `<details>` receipt cards with the vermillion +/–
 * marker, shared by every marketing accordion (landing, /how-it-works,
 * /pricing) so the site keeps a single FAQ treatment. No client JavaScript;
 * keyboard- and screen-reader-friendly.
 */
export function FaqDetailsList({
  items,
  className,
}: {
  items: readonly Faq[]
  className?: string
}) {
  return (
    <div className={cn("grid gap-x-8 gap-y-3", className)}>
      {items.map((faq) => (
        <details
          key={faq.q}
          className="group rounded-[var(--radius)] border-2 border-ink bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-[1.05rem] leading-snug font-extrabold sm:px-5 sm:py-4">
            <span>{faq.q}</span>
            <span
              aria-hidden="true"
              className="shrink-0 font-mono text-2xl leading-none text-primary"
            >
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">–</span>
            </span>
          </summary>
          <p className="max-w-[62ch] px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
            {faq.a}
          </p>
        </details>
      ))}
    </div>
  )
}

/**
 * FAQ — the honest answers, rendered with the shared FAQ face.
 *
 * `limit` renders only the first N questions (the conversion spine shows 4;
 * /how-it-works keeps the full set). Callers slicing the FAQPage schema must
 * use the SAME slice so visible copy === structured data.
 */
export function LandingFaq({ limit }: { limit?: number } = {}) {
  const shown = limit ? faqs.slice(0, limit) : faqs
  return (
    <Section id="faq" width="narrow">
      <div className="text-center">
        <MonoTag tone="plain">Questions</MonoTag>
        <h2 className="mt-4 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
          The honest answers.
        </h2>
      </div>

      <FaqDetailsList items={shown} className="mt-6 lg:grid-cols-2" />
    </Section>
  )
}
