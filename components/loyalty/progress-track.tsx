import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

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
  const value = total > 0 ? Math.min(Math.max((current / total) * 100, 0), 100) : 0

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold">{label}</span>
        <span className="numeric-tabular text-muted-foreground">
          {current} / {total}
        </span>
      </div>
      <Progress
        value={value}
        aria-label={`${label}: ${current} of ${total}`}
        className="bg-accent [&_[data-slot=progress-indicator]]:bg-reward"
      />
    </div>
  )
}
