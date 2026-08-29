import { cn } from "@/lib/utils"

export type MemberMarkTone =
  "ready" | "waiting" | "new" | "quiet" | "redeemed" | "collecting"

const TONE_CLASSES: Record<MemberMarkTone, string> = {
  ready: "border-leaf bg-card text-foreground",
  waiting: "border-sun bg-card text-foreground",
  new: "border-ink bg-primary/10 text-foreground",
  quiet: "border-line-strong bg-secondary/70 text-muted-foreground",
  redeemed: "border-line-strong bg-secondary/70 text-muted-foreground",
  collecting: "border-ink bg-card text-foreground",
}

/**
 * Ledger roundel for a loyalty member — paper disc + ink border + mono initials.
 * Distinct from {@link VenueMark} (venue stamp) and {@link StampDot} (visit
 * progress) so merchant member lists never read as earned stamps.
 */
export function MemberMark({
  initials,
  tone = "collecting",
  label,
  size = 36,
  className,
}: {
  initials: string
  tone?: MemberMarkTone
  /** Accessible name when no adjacent text names the member. */
  label?: string
  size?: number
  className?: string
}) {
  const text = initials.trim().slice(0, 2).toUpperCase() || "?"

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-member-mark={tone}
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 font-mono font-bold shadow-xs",
        TONE_CLASSES[tone],
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
    >
      <span className="relative z-[1]">{text}</span>
    </span>
  )
}
