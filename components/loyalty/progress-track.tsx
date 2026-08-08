import { cn } from "@/lib/utils"
import { MonoTag } from "@/components/brand"
import { Progress } from "@/components/ui/progress"

/**
 * A second progress readout: eyebrow + "3 / 8" MonoTag + a bar.
 *
 * MERCHANT SURFACES ONLY, and deliberately not exported from
 * `components/loyalty`'s barrel (CUS 02#35). The customer system's whole
 * premise is that the stamp grid IS the progress readout, so a second one on a
 * member screen is a duplicate, not a helper. Keeping it out of the barrel is
 * what stops it drifting onto one — the three consumers
 * (invite-customers-form, dashboard-next-actions, and the launch panel's
 * comment) all import it by path.
 *
 * The audit called it dead. It is not: it has three live merchant consumers,
 * which is why this is a scoping change and not a deletion.
 */
export function ProgressTrack({
  current,
  total,
  label = "Reward progress",
  className,
}: {
  current: number
  total: number
  label?: string
  className?: string
}) {
  const value =
    total > 0 ? Math.min(Math.max((current / total) * 100, 0), 100) : 0

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{label}</span>
        <MonoTag tone="leaf" className="numeric-tabular">
          {current} / {total}
        </MonoTag>
      </div>
      {/* Track/fill identity comes from the unlayered [data-slot=progress]
          theming — no per-call-site colour overrides. */}
      <Progress value={value} aria-label={`${label}: ${current} of ${total}`} />
    </div>
  )
}
