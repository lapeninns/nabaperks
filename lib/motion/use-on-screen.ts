"use client"

import { useEffect, useState, type RefObject } from "react"

/**
 * True while the element is at least partly in the viewport.
 *
 * Used to stop decorative loops that are scrolled out of sight (01#17). Starts
 * `true` so the first paint matches SSR and the animation is never withheld
 * from a card that is already on screen; the observer corrects it immediately.
 *
 * Falls back to always-on where IntersectionObserver is unavailable — a missing
 * optimisation is better than a card that never animates.
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true)

  useEffect(() => {
    const element = ref.current

    if (!element || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: "128px" }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [ref])

  return onScreen
}
