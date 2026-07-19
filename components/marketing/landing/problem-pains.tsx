import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { PROBLEM } from "@/lib/marketing/facts"

/**
 * The pain section (offer pack doc 3 Step 2): the quiet-midweek problem plus
 * the objections pub owners actually raise, in their own voice. Sits before
 * pricing so the price feels justified. Every pain is answered by a feature
 * further down the page.
 */
export function ProblemPains() {
  return (
    <Section id="problem">
      <SectionHeader
        eyebrow="The midweek problem"
        title={PROBLEM.headline}
        description={PROBLEM.intro}
      />
      <ul className="grid gap-2.5 pt-6 sm:grid-cols-2">
        {PROBLEM.pains.map((pain) => (
          <li
            key={pain}
            className="flex items-start gap-3 rounded-lg border-2 border-dashed border-border bg-card p-4"
          >
            <span
              aria-hidden="true"
              className="mono-meta mt-0.5 shrink-0 text-muted-foreground"
            >
              “
            </span>
            <p className="text-sm leading-6 text-foreground">{pain}</p>
          </li>
        ))}
      </ul>
      <p className="pt-5 text-sm leading-6 font-bold text-foreground">
        {PROBLEM.turn}
      </p>
    </Section>
  )
}
