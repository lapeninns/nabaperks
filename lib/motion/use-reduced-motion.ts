"use client"

import { useEffect, useState } from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Returns true if the user has set prefers-reduced-motion: reduce.
 *
 * Initialises from `matchMedia` synchronously on the client (lazy initial
 * state) so reduced-motion users cannot catch the first frames of a
 * JS-driven entrance during hydration; the CSS neutraliser cannot stop
 * Framer's inline styles. SSR renders `false` and corrects on mount.
 */
export function useReducedMotionHook(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(REDUCED_MOTION_QUERY).matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches)

    updateReducedMotion()
    mediaQuery.addEventListener("change", updateReducedMotion)

    return () => {
      mediaQuery.removeEventListener("change", updateReducedMotion)
    }
  }, [])

  return reducedMotion
}
