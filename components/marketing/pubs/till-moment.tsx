import { IconRoundel } from "@/components/brand"
import { PUB_TILL_MOMENT } from "@/lib/marketing/facts"

/**
 * The floor process as an ordered walk-through — the part of any loyalty
 * scheme that repeats a hundred times a week and decides whether it survives.
 * Server component.
 */
export function TillMoment() {
  return (
    <div className="grid gap-4">
      <ol className="grid gap-0">
        {PUB_TILL_MOMENT.steps.map((step, index) => (
          <li
            key={step}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 border-b-2 border-dashed border-border py-3.5 last:border-b-0"
          >
            {/* DESIGN.md · Shapes: new framing circles reach for IconRoundel
                rather than hand-rolling `rounded-full`. `sm` is the numbered
                step disc LaunchSteps and ProcessHero already use, so the same
                idiom is now one size across the three pages. */}
            <IconRoundel size="sm" tone="card" className="mono-meta">
              {index + 1}
            </IconRoundel>
            <p className="max-w-[64ch] text-base leading-7 text-muted-foreground">
              {step}
            </p>
          </li>
        ))}
      </ol>
      <p className="max-w-[68ch] border-l-2 border-ink pl-4 text-base leading-7 font-extrabold text-foreground">
        {PUB_TILL_MOMENT.closing}
      </p>
    </div>
  )
}
