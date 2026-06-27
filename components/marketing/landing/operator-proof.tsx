import { MonoTag } from "@/components/brand"
import { Section } from "@/components/layout"

/**
 * Operator proof — the E-E-A-T "Experience" block: the first-person operator POV
 * behind the product (what we've learned running no-app loyalty with real UK
 * venues). Operator/team voice, no named founder. Distinct from the feature
 * sections: it states the three faults we designed out, the un-synthesizable
 * angle answer engines and skeptical owners both reward. Server component.
 */
const faults = [
  {
    title: "The install tax",
    body: "Most schemes want a download or a wallet pass before the first stamp, so we made our card open and save in one browser tap, with nothing to install.",
  },
  {
    title: "Stamps anyone can fake",
    body: "A read-out code, a screenshot or a photocopied paper card barely counts as a check, so customers scan themselves and we verify every stamp against your venue QR, capped at one per customer per UK date.",
  },
  {
    title: "Spam in a loyalty badge",
    body: "Too many schemes are a marketing list in disguise, so we keep loyalty and marketing as separate records — a regular can collect and redeem without ever being signed up to promotions.",
  },
] as const

export function OperatorProof() {
  return (
    <Section id="operator-proof">
      <div className="max-w-[46ch]">
        <MonoTag tone="leaf">From the counter</MonoTag>
        <h2 className="mt-4 text-[clamp(1.85rem,4vw,2.75rem)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance">
          What most loyalty apps get wrong.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
          We run no-app loyalty with real UK food and drink venues, and the same
          three faults turn up every time. We designed each one out.
        </p>
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {faults.map((fault, index) => (
          <li key={fault.title} className="surface-card p-5">
            <p className="font-mono text-[0.7rem] font-bold tracking-[0.1em] text-primary uppercase">
              Fault {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-2 text-lg leading-snug font-extrabold text-balance">
              {fault.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {fault.body}
            </p>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-6 max-w-[28ch] text-center text-[clamp(1.25rem,2.8vw,1.65rem)] leading-snug font-extrabold text-balance">
        Loyalty should reward regulars, not tax them.
      </p>
    </Section>
  )
}
