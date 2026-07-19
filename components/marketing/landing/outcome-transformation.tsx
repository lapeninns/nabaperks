import {
  ArrowRight02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import { Icon, ReceiptCard, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { TRANSFORMATION, VALUE_MATH } from "@/lib/marketing/facts"

/**
 * The transformation (offer pack doc 3 Step 1): before → after, in concrete
 * buckets with no invented precision, then the price-to-value maths that leads
 * straight into the pricing section. The maths always renders with its
 * example label.
 */
export function OutcomeTransformation() {
  return (
    <Section id="outcome">
      <SectionHeader eyebrow="The change" title={TRANSFORMATION.heading} />
      <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="grid content-start gap-3 rounded-lg border-2 border-dashed border-border bg-card p-6">
          <p className="mono-meta text-muted-foreground">Before</p>
          <ul className="grid gap-2.5">
            {TRANSFORMATION.before.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Icon
                  icon={Cancel01Icon}
                  size={18}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <span className="text-sm leading-6 text-muted-foreground">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid place-items-center">
          <span className="grid size-11 rotate-90 place-items-center rounded-full border-2 border-ink bg-primary text-primary-foreground lg:rotate-0">
            <Icon icon={ArrowRight02Icon} size={20} />
          </span>
        </div>
        <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-6 shadow-sm">
          <p className="mono-meta text-primary">After</p>
          <ul className="grid gap-2.5">
            {TRANSFORMATION.after.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Icon
                  icon={CheckmarkCircle02Icon}
                  size={18}
                  className="mt-0.5 shrink-0 text-reward"
                />
                <span className="text-sm leading-6 text-foreground">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ReceiptCard edge padding="md" wrapperClassName="pt-6" className="gap-2">
        <p className="mono-meta text-muted-foreground">Does the maths work?</p>
        <p className="text-sm leading-6 text-muted-foreground">
          {VALUE_MATH.assumptionLine}
        </p>
        <p className="text-xl leading-snug font-extrabold text-foreground">
          {VALUE_MATH.coverLine}
        </p>
        <p className="mono-id text-muted-foreground uppercase">
          {VALUE_MATH.illustrativeNote}
        </p>
      </ReceiptCard>
    </Section>
  )
}
