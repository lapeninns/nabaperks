import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { PROBLEM } from "@/lib/marketing/facts"

import { SnapRail, SnapRailItem } from "./snap-rail"

/**
 * The pain section (offer pack doc 3 Step 2): the quiet-midweek problem plus
 * the objections pub owners actually raise, in their own voice. Sits before
 * pricing so the price feels justified. On phones the eight quotes ride a
 * horizontal snap rail to keep the page short; from `sm` up they grid.
 */
export function ProblemPains() {
  return (
    <Section id="problem" size="dense">
      <SectionHeader
        eyebrow="The midweek problem"
        title={PROBLEM.headline}
        description={PROBLEM.intro}
      />
      <div className="pt-5 sm:pt-6">
        <SnapRail
          label="What pub owners say about loyalty schemes"
          className="sm:grid-cols-2"
        >
          {PROBLEM.pains.map((pain) => (
            <SnapRailItem
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
            </SnapRailItem>
          ))}
        </SnapRail>
      </div>
      <p className="pt-4 text-sm leading-6 font-bold text-foreground sm:pt-5">
        {PROBLEM.turn}
      </p>
    </Section>
  )
}
