"use client"

import { useEffect } from "react"

export function PlaywrightHydrationSignal() {
  useEffect(() => {
    document.body.inert = false
    document.documentElement.dataset.playwrightHydrated = "true"

    return () => {
      delete document.documentElement.dataset.playwrightHydrated
    }
  }, [])

  return null
}
