import { Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Icon, MonoTag, SectionHeader } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { MARKET } from "@/lib/marketing/facts"

/** The offer pack's qualification rules, visible before the conversion CTA. */
export function VenueFit() {
  return (
    <Section id="fit" size="dense">
      <SectionHeader
        eyebrow="Check your pub's fit"
        title="Built for a specific kind of pub"
        description="The launch works best when you already have weekend demand and want a simple way to encourage measurable midweek returns."
      />
      <div className="grid gap-5 pt-5 lg:grid-cols-2 lg:gap-8 lg:pt-6">
        <FitList
          label="A strong fit"
          tone="leaf"
          items={MARKET.qualify}
          icon={CheckmarkCircle02Icon}
          iconClassName="text-reward"
        />
        <FitList
          label="Not the standard launch"
          tone="ink"
          items={MARKET.disqualify}
          icon={Cancel01Icon}
          iconClassName="text-muted-foreground"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t-2 border-dashed border-border pt-5">
        <Button asChild size="lg">
          <MarketingSignupLink>Start your free pilot</MarketingSignupLink>
        </Button>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          We confirm launch capacity honestly. If the current week is full, your
          pub moves to the next available print batch.
        </p>
      </div>
    </Section>
  )
}

function FitList({
  label,
  tone,
  items,
  icon,
  iconClassName,
}: {
  label: string
  tone: "leaf" | "ink"
  items: readonly string[]
  icon: Parameters<typeof Icon>[0]["icon"]
  iconClassName: string
}) {
  return (
    <div className="grid content-start gap-3">
      <MonoTag tone={tone} className="justify-self-start">
        {label}
      </MonoTag>
      <ul className="grid gap-2.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 border-b-2 border-dashed border-border pb-2.5"
          >
            <Icon
              icon={icon}
              size={18}
              className={`mt-0.5 shrink-0 ${iconClassName}`}
            />
            <span className="text-sm leading-6 text-muted-foreground">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
