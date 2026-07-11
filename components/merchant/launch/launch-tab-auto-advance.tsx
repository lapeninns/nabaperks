"use client"

import { useEffect } from "react"

export function LaunchTransientQueryCleanup({
  cleanHref,
}: {
  cleanHref: string | null
}) {
  useEffect(() => {
    if (!cleanHref) {
      return
    }

    // Scrub the one-shot success params from the URL *without* an RSC refetch.
    // `router.replace` would re-render this force-dynamic page without the
    // saved/seeded/created/enabled/qr params and blank the just-shown success
    // banner; `history.replaceState` only rewrites the address bar, leaving the
    // already-rendered tree (and its banner) intact. Passing the current
    // history state keeps Next's App Router navigation state consistent.
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", cleanHref)
    }
  }, [cleanHref])

  return null
}
