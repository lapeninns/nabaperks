import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/lib/utils"

/** A Hugeicons glyph reference (e.g. `Home01Icon` from `@hugeicons/core-free-icons`). */
export type IconGlyph = ComponentProps<typeof HugeiconsIcon>["icon"]

/**
 * The brand icon wrapper. Nabaperks uses the **@hugeicons** free set as its
 * single icon system; `Icon` applies the house defaults (2px stroke, current
 * colour, no shrink) so call sites stay terse. Decorative by default — pass
 * `label` to give the icon an accessible name, otherwise it renders
 * `aria-hidden`. Size via the `size` prop or a `size-*` utility class.
 */
export function Icon({
  icon,
  size = 20,
  strokeWidth = 2,
  className,
  label,
  ...rest
}: {
  icon: IconGlyph
  size?: number
  strokeWidth?: number
  className?: string
  /** Accessible name. Omit for decorative icons (rendered `aria-hidden`). */
  label?: string
} & Omit<
  ComponentProps<typeof HugeiconsIcon>,
  "icon" | "size" | "strokeWidth" | "className"
>) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      className={cn("inline-block shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    />
  )
}
