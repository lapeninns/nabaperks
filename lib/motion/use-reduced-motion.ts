"use client"

import { useEffect, useState } from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Returns true if the user has set prefers-reduced-motion: reduce.
 */
export function useReducedMotionHook(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

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
