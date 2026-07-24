import { Section } from "@/components/layout"
import { OPERATOR, PRODUCT, SCARCITY } from "@/lib/marketing/facts"

/**
 * A bare fact row — deliberately headerless. Every band on the old landing
 * opened with an eyebrow + title + description; this one states four checkable
 * facts and gets out of the way. It is the page's first break in rhythm.
 */
export function ProofLine() {
  const facts = [
    `Built and run by ${OPERATOR.name}`,
    `A ${PRODUCT.term} — no app to download`,
    "Return visits shown in your dashboard",
    SCARCITY.capLine,
  ] as const

  return (
    <Section id="proof" size="compact">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y-2 border-ink py-3">
        {facts.map((fact) => (
          <li
            key={fact}
            className="text-sm leading-6 font-bold text-foreground"
          >
            {fact}
          </li>
        ))}
      </ul>
    </Section>
  )
}
