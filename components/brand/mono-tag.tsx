import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Icon, type IconGlyph } from "./icon"

type MonoTagTone = "plain" | "accent" | "cobalt" | "ink" | "leaf" | "sun"

const TONE: Record<MonoTagTone, string> = {
  plain: "",
  // Every filled tone carries the ink border — a primary-on-primary border
  // reads as borderless next to its ink-bordered siblings.
  accent: "border-ink bg-primary text-primary-foreground",
  cobalt: "border-ink bg-cobalt text-paper",
  ink: "border-ink bg-ink text-paper",
  leaf: "border-ink bg-reward text-reward-foreground",
  sun: "border-ink bg-seal text-seal-foreground",
}

/**
 * Mono pill tag — the proto's `MonoTag`. Composes the shadcn `Badge` primitive
 * (already mono/uppercase/pill via the `[data-slot="badge"]` layer) and layers
 * the `.w-tag` shape plus a spot-ink tone. Tones use tokens only.
 *
 * Long copy story: the pill caps at its container width and the content span
 * truncates with an ellipsis, so a long venue or reward name can never push a
 * card row into horizontal overflow.
 */
export function MonoTag({
  children,
  tone = "plain",
  icon,
  className,
}: {
  children: ReactNode
  tone?: MonoTagTone
  /** Optional leading glyph from the @hugeicons set. */
  icon?: IconGlyph
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("w-tag", icon && "gap-1", TONE[tone], className)}
    >
      {icon ? <Icon icon={icon} size={13} strokeWidth={2.25} /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </Badge>
  )
}
