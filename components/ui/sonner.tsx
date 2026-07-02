"use client"

import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons"

/**
 * Wet Ink toast surface. This wrapper OWNS the toast theme:
 *
 * - the `cn-toast` class is themed in app/globals.css (2px ink border, card
 *   ground, hard offset shadow, StatusBanner-matching tone washes);
 * - `richColors` is deliberately swallowed and forced off so sonner's stock
 *   green/red/amber palette can never bypass the leaf/vermillion/cobalt spot
 *   inks, whatever a mount point passes;
 * - status icons are decorative (`aria-hidden`) — the toast copy already
 *   announces the state in the live region;
 * - the loading `animate-spin` is the sanctioned CSS-animation exception to
 *   "motion lives in Framer" (see DESIGN.md Motion), guarded by
 *   `motion-reduce:animate-none`.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4"
          />
        ),
        info: (
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4"
          />
        ),
        warning: (
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4"
          />
        ),
        error: (
          <HugeiconsIcon
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4"
          />
        ),
        loading: (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
      richColors={false}
    />
  )
}

export { Toaster }
