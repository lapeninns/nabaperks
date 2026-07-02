"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

const noopSubscribe = () => () => {}

/** True after hydration — SSR snapshot is false, client snapshot is true. */
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}

/**
 * Dev-only toggle for the dormant "night printing" palette (globals.css
 * `.dark` block). Dark mode ships deliberately unreachable in production —
 * this catalog toggle exists so dark-critical rules (QR stays on pure white,
 * shadow colour swap) can be regression-checked without exposing a user
 * switch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        Night printing
      </Button>
    )
  }

  const dark = resolvedTheme === "dark"

  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? "Back to daylight" : "Night printing"}
    </Button>
  )
}
