import { cn } from "@/lib/utils"

export function StampDot({
  earned,
  label,
  date,
  slammed = false,
  className,
}: {
  earned: boolean
  label: string
  date?: string
  /** Fire the print-slam keyframe on a freshly-earned stamp. */
  slammed?: boolean
  className?: string
}) {
  return (
    <span className="grid justify-items-center gap-1">
      <span
        role="img"
        aria-label={label}
        data-earned={earned}
        data-slammed={earned && slammed ? true : undefined}
        // Inline animation (the proven Marquee pattern) — global
        // prefers-reduced-motion clamps it, and w-slam lands on the resting
        // -rotate-6 earned state so it snaps cleanly when reduced.
        style={
          earned && slammed
            ? { animation: "w-slam var(--w-dur-slam) var(--w-ease-slam) both" }
            : undefined
        }
        className={cn(
          "grid aspect-square min-h-11 w-full place-items-center rounded-full border-2 transition-[background-color,border-color,transform] duration-[var(--duration-reveal)] ease-[var(--ease-stamp)] motion-reduce:transition-none",
          earned
            ? "-rotate-6 border-ink bg-stamp text-stamp-foreground shadow-xs"
            : "border-dashed border-border bg-background text-muted-foreground",
          className
        )}
      >
        <span aria-hidden="true" className="text-xl leading-none font-extrabold">
          {earned ? "✱" : ""}
        </span>
      </span>
      {date ? (
        <span className="font-mono text-[0.55rem] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          {date}
        </span>
      ) : null}
    </span>
  )
}

export function StampGrid({
  current,
  total,
  dates,
  slamIndex = -1,
  className,
}: {
  current: number
  total: number
  dates?: string[]
  /** Index of the just-earned stamp to slam (-1 = none). */
  slamIndex?: number
  className?: string
}) {
  const safeTotal = Math.max(total, 0)
  const safeCurrent = Math.min(Math.max(current, 0), safeTotal)

  return (
    <div
      role="list"
      aria-label={`${safeCurrent} of ${safeTotal} stamps earned`}
      className={cn("grid gap-2", className)}
      style={{
        gridTemplateColumns: `repeat(${Math.min(Math.max(safeTotal, 1), 6)}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: safeTotal }).map((_, index) => {
        const earned = index < safeCurrent

        return (
          <span key={index} role="listitem">
            <StampDot
              earned={earned}
              label={`Stamp ${index + 1} ${earned ? "earned" : "empty"}`}
              date={dates?.[index]}
              slammed={index === slamIndex}
            />
          </span>
        )
      })}
    </div>
  )
}
