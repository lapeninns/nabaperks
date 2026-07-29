import { Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon, MonoTag } from "@/components/brand"
import { MARKET, type MarketingPersona } from "@/lib/marketing/facts"

/**
 * The qualification tables — the one band the pub hub has always genuinely
 * owned, carried over from the previous composition unchanged in substance.
 *
 * The disqualify column is styled as quietly as the qualify column on purpose:
 * a fit test that visually punishes the "no" answer isn't a fit test.
 * Server component.
 */
export function PubFitTest({ persona }: { persona: MarketingPersona }) {
  return (
    <div className="grid gap-5">
      <p className="max-w-[68ch] text-base leading-7 text-muted-foreground">
        {persona.fitNote}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-4 rounded-lg border-2 border-ink bg-card p-5 shadow-sm sm:p-6">
          <MonoTag tone="leaf" className="justify-self-start">
            This fits
          </MonoTag>
          <h3 className="text-xl leading-snug font-extrabold text-foreground">
            Your pub is ready if…
          </h3>
          <ul className="grid gap-3">
            {MARKET.qualify.map((rule) => (
              <li key={rule} className="flex items-start gap-3">
                <Icon
                  icon={CheckmarkCircle02Icon}
                  size={18}
                  className="mt-0.5 shrink-0 text-reward"
                />
                <span className="text-sm leading-6 text-foreground">
                  {rule}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-4 rounded-lg border-2 border-dashed border-line-strong bg-card p-5 sm:p-6">
          <MonoTag tone="ink" className="justify-self-start">
            Not right yet
          </MonoTag>
          <h3 className="text-xl leading-snug font-extrabold text-foreground">
            We will say so if…
          </h3>
          <ul className="grid gap-3">
            {MARKET.disqualify.map((rule) => (
              <li key={rule} className="flex items-start gap-3">
                <Icon
                  icon={Cancel01Icon}
                  size={18}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <span className="text-sm leading-6 text-muted-foreground">
                  {rule}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
