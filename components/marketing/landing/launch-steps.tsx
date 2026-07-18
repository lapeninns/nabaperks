import { IconRoundel } from "@/components/brand"
import { DFY_LAUNCH } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * The done-for-you launch sequence from the offer master doc — an ordered list
 * of the five "we do / you go live" steps. Shared by the landing page and the
 * how-it-works page so the sequence can never fork.
 */
export function LaunchSteps({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-3.5", className)}>
      {DFY_LAUNCH.steps.map((step, index) => {
        const last = index === DFY_LAUNCH.steps.length - 1

        return (
          <li
            key={step.title}
            className="flex items-start gap-4 rounded-lg border-2 border-ink bg-card p-4 shadow-sm"
          >
            <IconRoundel
              size="sm"
              tone={last ? "primary" : "secondary"}
              className="mono-meta mt-0.5"
            >
              {index + 1}
            </IconRoundel>
            <div className="grid gap-1">
              <h3 className="text-base leading-snug font-extrabold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {step.detail}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
