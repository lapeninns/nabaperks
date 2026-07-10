import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Icon, type IconGlyph } from "./icon"

const ROUNDEL_SIZE = {
  /** 32px — numbered step discs. */
  sm: "size-8",
  /** 40px — compact icon roundels. */
  md: "size-10",
  /** 44px — the standard icon roundel. */
  lg: "size-11",
} as const

const ROUNDEL_TONE = {
  secondary: "bg-secondary text-foreground",
  accent: "bg-accent text-foreground",
  card: "bg-card text-foreground",
  primary: "bg-primary text-primary-foreground",
} as const

const ROUNDEL_ICON_SIZE: Record<keyof typeof ROUNDEL_SIZE, number> = {
  sm: 14,
  md: 16,
  lg: 18,
}

/**
 * IconRoundel — the sanctioned static circle that frames a glyph or a step
 * number (DESIGN.md · Shapes, the EmptyState-roundel family). A framing
 * control: unrotated, 2px ink border, never a reward mark — stamps and seals
 * keep their own rotated circle family. Decorative by default (`aria-hidden`);
 * pass `label` when the glyph is the only carrier of meaning.
 */
export function IconRoundel({
  icon,
  iconSize,
  iconStrokeWidth,
  size = "lg",
  tone = "secondary",
  label,
  className,
  children,
}: {
  /** Glyph mode — a Hugeicons glyph rendered through the brand Icon wrapper. */
  icon?: IconGlyph
  iconSize?: number
  iconStrokeWidth?: number
  size?: keyof typeof ROUNDEL_SIZE
  tone?: keyof typeof ROUNDEL_TONE
  /** Announce the roundel; omitted = decorative (`aria-hidden`). */
  label?: string
  className?: string
  /** Content mode — a step number or short mark instead of a glyph. */
  children?: ReactNode
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 border-ink",
        ROUNDEL_SIZE[size],
        ROUNDEL_TONE[tone],
        className
      )}
    >
      {icon ? (
        <Icon
          icon={icon}
          size={iconSize ?? ROUNDEL_ICON_SIZE[size]}
          strokeWidth={iconStrokeWidth}
        />
      ) : (
        children
      )}
    </span>
  )
}
