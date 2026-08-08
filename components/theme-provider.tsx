"use client"

import * as React from "react"
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from "next-themes"

import { MotionProvider } from "@/components/motion/motion-provider"
import { NEXT_THEMES_OPTIONS } from "@/lib/theme/next-themes-options"

type NabaperksThemeProviderProps = ThemeProviderProps & {
  enableHotkey?: boolean
}

function ThemeHotkey({ enabled }: { enabled: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isEditing = target?.closest(
        "input, textarea, select, [contenteditable='true']"
      )

      if (isEditing) return

      const isThemeShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.code === "KeyD"

      if (!isThemeShortcut) return

      event.preventDefault()
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, resolvedTheme, setTheme])

  return null
}

export function ThemeProvider({
  children,
  enableHotkey = false,
  ...props
}: NabaperksThemeProviderProps) {
  return (
    <NextThemesProvider {...NEXT_THEMES_OPTIONS} {...props}>
      <MotionProvider>
        <ThemeHotkey enabled={enableHotkey} />
        {children}
      </MotionProvider>
    </NextThemesProvider>
  )
}
