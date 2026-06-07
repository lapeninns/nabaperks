import { cn } from "@/lib/utils"

export function StampDot({
  earned,
  label,
  className,
}: {
  earned: boolean
  label: string
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label={label}
      data-earned={earned}
      className={cn(
        "grid aspect-square min-h-11 place-items-center rounded-full transition-[background-color,border-color,transform] duration-[var(--duration-reveal)] ease-[var(--ease-stamp)] motion-reduce:transition-none",
        earned
          ? "bg-stamp text-stamp-foreground shadow-xs"
          : "border border-dashed border-border bg-background text-muted-foreground",
        className
      )}
    >
      <span aria-hidden="true" className={cn("size-3 rounded-full", earned ? "bg-stamp-foreground/50" : "bg-border")} />
    </span>
  )
}

export function StampGrid({
  current,
  total,
  className,
}: {
  current: number
  total: number
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
            />
          </span>
        )
      })}
    </div>
  )
}
