import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Icon, STATUS_ICON, type StatusKind } from "@/components/brand"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const statusClasses = {
  success: "border-2 border-ink bg-reward/12 text-foreground",
  warning: "border-2 border-ink bg-primary/12 text-foreground",
  error: "border-2 border-ink bg-destructive/10 text-destructive-strong",
  // Cobalt is the info/join spot ink (DESIGN.md Colors) — a wash, ink text.
  info: "border-2 border-ink bg-cobalt/10 text-foreground",
  neutral: "border-2 border-ink bg-card text-card-foreground",
} as const

export type StatusBannerTone = keyof typeof statusClasses

// Pair each visual tone with its semantic glyph so state reads as icon + colour
// + copy, never colour alone (warning and error are near-adjacent warm reds).
const toneIconKind: Record<StatusBannerTone, StatusKind> = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
  neutral: "info",
}

/**
 * Tone drives the announcement, not just the colour. `Alert` hardcodes
 * `role="alert"`, which is assertive — it interrupts whatever a screen reader
 * is currently saying. That is right for an error or a warning and wrong for a
 * save confirmation or an informational note, which should queue politely.
 * Since Alert spreads props after its own role, passing one here wins.
 */
const toneRole: Record<StatusBannerTone, "alert" | "status"> = {
  success: "status",
  warning: "alert",
  error: "alert",
  info: "status",
  neutral: "status",
}

export function StatusBanner({
  title,
  children,
  tone = "neutral",
  className,
}: {
  title: ReactNode
  children?: ReactNode
  tone?: StatusBannerTone
  className?: string
}) {
  const role = toneRole[tone]

  return (
    <Alert
      role={role}
      aria-live={role === "status" ? "polite" : undefined}
      className={cn(statusClasses[tone], className)}
    >
      <Icon icon={STATUS_ICON[toneIconKind[tone]]} className="text-current" />
      <AlertTitle className="font-extrabold">{title}</AlertTitle>
      {children ? (
        <AlertDescription className="text-current">{children}</AlertDescription>
      ) : null}
    </Alert>
  )
}
