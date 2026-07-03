"use client"

import { useEffect } from "react"

/**
 * One-shot celebration flags (`welcome=1`, `stamp=issued`, `reward=redeemed`,
 * `geo=flagged`, `firststamp=pending`, `collected=1`) arrive on the customer
 * and merchant reward URLs from one-shot handoffs. Once the screen has rendered
 * them, this strips the params via `history.replaceState` — no navigation, no
 * re-render — so a refresh or a shared link does not replay the celebration as
 * if it just happened (CUS-P3-07).
 */
const CELEBRATION_PARAMS = [
  "welcome",
  "stamp",
  "reward",
  "geo",
  "firststamp",
  "collected",
] as const

export function CelebrationUrlCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href)
    let changed = false

    for (const param of CELEBRATION_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        changed = true
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, "", url)
    }
  }, [])

  return null
}
