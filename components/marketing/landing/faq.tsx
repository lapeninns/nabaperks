import { MonoTag } from "@/components/brand"

const faqs = [
  {
    q: "Do customers need an app?",
    a: "No app and no extra hardware. Customers scan your QR with the camera they already have, and the card opens in their phone browser. You run it from any phone, tablet, or till screen.",
  },
  {
    q: "How are stamps checked?",
    a: "The customer scans your venue QR and taps to claim. The server checks the QR, membership, billing status, and UK date before confirming the stamp, so the phone never crosses the counter.",
  },
  {
    q: "Can I control how stamps are earned?",
    a: "The live flow is self-service QR stamping: one stamp per customer per UK date, checked server-side. You can configure the reward threshold and optional GPS anomaly checks without adding a CRM or POS integration.",
  },
  {
    q: "Can people collect stamps without marketing consent?",
    a: "Yes. Loyalty participation and marketing opt-in stay separate. A customer can collect stamps and redeem rewards without joining a marketing list.",
  },
  {
    q: "What does it cost after the pilot?",
    a: "You can build the card and preview the QR flow first. Add billing when you activate your live venue QR. After the 30-day pilot it is £29/month for one venue, with no contracts.",
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
