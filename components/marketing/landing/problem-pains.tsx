import { SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { PROBLEM } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

import { SnapRail, SnapRailItem } from "./snap-rail"

/**
 * The pain section as the kitchen noticeboard: the eight objections pub
 * owners actually raise, pinned as numbered tickets in the owner's own voice.
 * Each ticket tilts a touch off-square from `sm` up — the riso tack of the
 * board — while on phones they ride the horizontal snap rail to keep the page
 * short. The "turn" closes the board as one bold declarative.
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
          className="sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROBLEM.pains.map((pain, index) => (
            <SnapRailItem
              key={pain}
              className={cn(
                "grid content-start gap-3 rounded-lg border-2 border-dashed border-border bg-card p-4",
                index % 2 === 0 ? "sm:-rotate-1" : "sm:rotate-1"
              )}
            >
              <span
                aria-hidden="true"
                className="mono-id text-muted-foreground uppercase"
              >
                Nº {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-6 font-bold text-foreground">
                “{pain}”
              </p>
            </SnapRailItem>
          ))}
        </SnapRail>
      </div>
      <p className="pt-5 text-base leading-7 font-extrabold text-balance text-foreground sm:pt-6 sm:text-lg">
        {PROBLEM.turn}
      </p>
    </Section>
  )
}
