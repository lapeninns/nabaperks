import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { PUB_LOYALTY_FAILURES } from "@/lib/marketing/facts"

/**
 * The five ways pub loyalty schemes die, each paired with the fix.
 *
 * Symptom and fix sit in one row so the page never states a problem it can't
 * answer — and every fix here is something the publican controls, not a feature
 * to buy. Server component.
 */
export function FailureModes() {
  return (
    <ul className="grid gap-3">
      {PUB_LOYALTY_FAILURES.map((failure) => (
        <li
          key={failure.symptom}
          className="grid gap-3 rounded-lg border-2 border-ink bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:gap-6 sm:p-5"
        >
          <div className="grid content-start gap-1.5">
            <div className="flex items-start gap-2.5">
              <Icon
                icon={Alert02Icon}
                size={18}
                className="mt-0.5 shrink-0 text-primary"
              />
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {failure.symptom}
              </h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground sm:pl-7">
              {failure.why}
            </p>
          </div>
          <div className="flex items-start gap-2.5 border-t-2 border-dashed border-border pt-3 sm:border-t-0 sm:border-l-2 sm:pt-0 sm:pl-6">
            <Icon
              icon={CheckmarkCircle02Icon}
              size={18}
              className="mt-0.5 shrink-0 text-reward"
            />
            <p className="text-sm leading-6 text-foreground">
              <span className="mono-id block text-muted-foreground uppercase">
                The fix
              </span>
              {failure.fix}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
