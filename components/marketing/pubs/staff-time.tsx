import { MonoTag, ReceiptCard } from "@/components/brand"
import { PUB_STAFF_TIME } from "@/lib/marketing/facts"

const PHASES = [
  { ...PUB_STAFF_TIME.perStamp, tone: "accent" },
  { ...PUB_STAFF_TIME.weekly, tone: "cobalt" },
  { ...PUB_STAFF_TIME.setup, tone: "sun" },
] as const

/**
 * What the scheme costs the people running it, split by when the cost lands —
 * per stamp, per week, and up front. The up-front row is the one vendors leave
 * out of a price comparison, so it gets the same weight as the other two.
 * Server component.
 */
export function StaffTime() {
  return (
    <div className="grid gap-4">
      {/* Three-up at `sm:` gave each card a ~24-character measure inside the
          guide column. The break moves to `md:`, where the columns are wide
          enough to set a sentence. */}
      <ul className="grid gap-3 md:grid-cols-3">
        {PHASES.map((phase) => (
          <li
            key={phase.when}
            className="grid content-start gap-2.5 rounded-lg border-2 border-ink bg-card p-4 shadow-sm sm:p-5"
          >
            <MonoTag tone={phase.tone} className="justify-self-start">
              {phase.when}
            </MonoTag>
            <p className="text-sm leading-6 text-muted-foreground">
              {phase.detail}
            </p>
          </li>
        ))}
      </ul>
      <ReceiptCard edge padding="md" className="gap-2">
        <p className="mono-meta text-muted-foreground">The test that matters</p>
        <p className="text-base leading-7 font-extrabold text-foreground">
          {PUB_STAFF_TIME.warning}
        </p>
      </ReceiptCard>
    </div>
  )
}
