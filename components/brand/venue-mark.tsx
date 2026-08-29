import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

import { Icon } from "./icon"

/** Two-letter venue roundel text from a business name, e.g. "Old Crown Girton" → OC.
 * Returns "" when no letters can be derived — callers render the stamp icon. */
export function deriveVenueInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * Rubber-stamp venue roundel — a rotated ink-bordered disc in the action ink,
 * part of the Wet Ink stamp family. Used on receipts, cards, and quote blocks.
 * Pass `initials` directly, or `name` to derive them from a business name.
 * The disc itself is decorative; pass `label` (mirroring RewardSeal's
 * `role="img"` pattern) when no adjacent text names the venue.
 */
export function VenueMark({
  initials,
  name,
  caption,
  label,
  size = 56,
  className,
}: {
  initials?: string
  name?: string
  caption?: string
  /** Accessible name for the mark when no adjacent text provides one. */
  label?: string
  size?: number
  className?: string
}) {
  const derived = initials ?? (name ? deriveVenueInitials(name) : "")
  const text = derived.length > 0 ? derived : null

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "inline-grid place-items-center gap-1 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        data-stamp-earned="true"
        className="relative grid place-items-center overflow-hidden rounded-full border-2 border-ink bg-stamp font-mono font-bold text-stamp-foreground shadow-xs"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
      >
        {text ? (
          <span className="relative z-[1]">{text}</span>
        ) : (
          <Icon
            icon={CheckmarkBadge04Icon}
            size={Math.round(size * 0.5)}
            className="relative z-[1]"
          />
        )}
      </span>
      {caption ? (
        <span className="mono-id tracking-tag text-muted-foreground">
          {caption}
        </span>
      ) : null}
    </span>
  )
}
