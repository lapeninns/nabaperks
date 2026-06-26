import { MonoTag } from "@/components/brand"

const faqs = [
  {
    q: "Do customers need an app or extra hardware?",
    a: "No app and no extra hardware. Customers scan your QR with the camera they already have, and the card opens in their phone browser. You run it from any phone, tablet, or till screen.",
  },
  {
    q: "How is a stamp kept honest?",
    a: "Every stamp is written on the server and kept on the record — one per UK business day, scoped to your venue. There is no offline tally to fudge and no way to stamp the same card twice in a day.",
  },
  {
    q: "What if location looks wrong?",
    a: "Stamps are tied to your venue, so a card opened elsewhere will not quietly collect with you. If a location check looks off, the stamp simply does not land, and nothing is lost.",
  },
  {
    q: "Can people collect stamps without marketing consent?",
    a: "Yes. Loyalty participation and marketing opt-in stay separate. A customer can collect every stamp and break every seal without ever opting in to hear from you.",
  },
  {
    q: "What does it cost after the pilot?",
    a: "The pilot runs free for 30 days, with a card required to activate. After that it is £29/month for one venue — no tiers, no contracts.",
  },
] as const

/**
 * FAQ — the honest answers, as native `<details>` so the accordion needs no
 * client JavaScript and stays keyboard- and screen-reader-friendly. Each panel
 * is its own receipt card with a vermillion +/– marker that flips on open.
 */
export function LandingFaq() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pt-12 sm:pt-16">
      <div className="text-center">
        <MonoTag tone="plain">Questions</MonoTag>
        <h2 className="mt-4 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance">
          The honest answers.
        </h2>
      </div>

      <div className="mt-8 grid gap-3">
        {faqs.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-[var(--radius)] border-2 border-ink bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="pressable flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[1.05rem] leading-snug font-extrabold outline-none focus-visible:ring-3 focus-visible:ring-ring/35">
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
    </section>
  )
}
