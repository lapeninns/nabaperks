import { cn } from "@/lib/utils"

function deriveInitials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")

  return letters || "✱"
}

/**
 * Rubber-stamp venue roundel — a rotated ink-bordered disc in the action ink,
 * part of the Wet Ink stamp family. Used on receipts, cards, and quote blocks.
 * Pass `initials` directly, or `name` to derive them from a business name.
 */
export function VenueMark({
  initials,
  name,
  caption,
  size = 56,
  className,
}: {
  initials?: string
  name?: string
  caption?: string
  size?: number
  className?: string
}) {
  const text = initials ?? (name ? deriveInitials(name) : "OC")

  return (
    <span
      className={cn("inline-grid place-items-center gap-1 text-center", className)}
    >
      <span
        aria-hidden="true"
        className="grid -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary font-extrabold tracking-tight text-primary-foreground shadow-xs"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      >
        {text}
      </span>
      {caption ? (
        <span className="font-mono text-[0.6rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {caption}
        </span>
      ) : null}
    </span>
  )
}
