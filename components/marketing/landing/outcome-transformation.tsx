import {
  ArrowRight02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import { Icon, IconRoundel, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { ValueMathReceipt } from "@/components/marketing"
import { TRANSFORMATION } from "@/lib/marketing/facts"

import { SnapRail, SnapRailItem } from "./snap-rail"

/**
 * The transformation: the venue's week, reprinted. The "before" ticket is a
 * dashed draft — muted, cancellable; the "after" ticket is the solid printed
 * card with leaf checks. On phones the two tickets ride a swipe rail (the
 * swipe IS the transformation); from `sm` up they sit around the hand-off
 * roundel. The maths closes as a tilted till-roll total, always with its
 * illustrative-example label.
 */
export function OutcomeTransformation() {
  return (
    <Section id="outcome" size="dense">
      <SectionHeader
        size="band"
        eyebrow="The change"
        title={TRANSFORMATION.heading}
      />
      <div className="pt-5 sm:pt-6">
        <SnapRail
          label="Before and after the launch"
          className="sm:grid-cols-[1fr_auto_1fr] sm:items-stretch"
        >
          <SnapRailItem className="grid content-start gap-3 rounded-lg border-2 border-dashed border-border bg-card p-4 sm:p-6">
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
          </SnapRailItem>
          {/* aria-hidden, NOT role="presentation". Overriding the role on a
              direct child of a <ul> makes it an element the list may not
              contain, which axe flags as a serious WCAG "list" violation —
              caught by the @a11y sweep on /how-it-works across all four
              browsers. aria-hidden removes the arrow from the accessibility
              tree entirely, so the labelled comparison still announces as two
              items, and the list structure stays valid.

              It is deliberately no longer `hidden` below `sm:` — the arrow IS
              the transformation, and hiding it left the swipe with no
              directional cue. */}
          <li
            aria-hidden="true"
            className="grid shrink-0 place-items-center px-1 sm:px-0"
          >
            <IconRoundel
              size="lg"
              tone="primary"
              icon={ArrowRight02Icon}
              iconSize={20}
            />
          </li>
          <SnapRailItem className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-4 shadow-sm sm:p-6">
            <p className="mono-meta text-reward">After</p>
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
          </SnapRailItem>
        </SnapRail>
      </div>
      <ValueMathReceipt
        rotated
        wrapperClassName="mx-auto max-w-2xl pt-5 sm:pt-7"
      />
    </Section>
  )
}
