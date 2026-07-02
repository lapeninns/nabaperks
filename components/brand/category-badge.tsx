import { cn } from "@/lib/utils"

import { ACTIVITY_CATEGORY_ICON, type ActivityCategory } from "./icons"
import { MonoTag } from "./mono-tag"

type CategoryBadgeTone = "plain" | "accent" | "cobalt" | "ink" | "leaf" | "sun"

/**
 * Canonical tone per merchant activity category. Kept in one place so the same
 * event is badged identically wherever it surfaces (activity feed, dashboard
 * compact feed). Every tone resolves to a solid spot-ink fill whose foreground
 * clears WCAG AA on the card surface — the previous low-opacity washes put the
 * `Stamp` label at ~4.44:1, just under 4.5:1.
 */
function categoryBadgeTone(category: ActivityCategory): CategoryBadgeTone {
  switch (category) {
    case "customer":
      return "cobalt"
    case "stamp":
      return "accent"
    case "reward":
      return "leaf"
    case "qr":
      return "sun"
    case "account":
      return "plain"
  }
}

/**
 * Extra classes for the one tone (`plain`) that `MonoTag` leaves unstyled, so
 * the `account` badge reads as a quiet secondary chip rather than a bare
 * outline. Spot-ink tones are fully handled by `MonoTag`.
 */
function categoryBadgePlainClass(category: ActivityCategory) {
  return category === "account"
    ? "border-border bg-secondary text-secondary-foreground"
    : undefined
}

/**
 * Shared category badge for the merchant activity surfaces. Mirrors
 * `lib/merchant/activity` categories onto a single tone + glyph mapping.
 */
export function CategoryBadge({
  category,
  label,
  className,
}: {
  readonly category: ActivityCategory
  readonly label: string
  readonly className?: string
}) {
  const tone = categoryBadgeTone(category)

  return (
    <MonoTag
      tone={tone}
      icon={ACTIVITY_CATEGORY_ICON[category]}
      className={cn(
        tone === "plain" && categoryBadgePlainClass(category),
        className
      )}
    >
      {label}
    </MonoTag>
  )
}
