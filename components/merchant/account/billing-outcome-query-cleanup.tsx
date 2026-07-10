"use client"

import { useEffect } from "react"

/**
 * Retire one-shot billing return flags after their first render without asking
 * the App Router to fetch a second server tree. The already-rendered outcome
 * remains visible; a refresh reads the clean URL and cannot replay it.
 */
export function BillingOutcomeQueryCleanup() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const searchParams = url.searchParams
    const before = searchParams.toString()

    searchParams.delete("checkout")
    searchParams.delete("portal")
    searchParams.delete("session_id")
    searchParams.delete("billing_error")

    if (searchParams.toString() === before) {
      return
    }

    const query = searchParams.toString()
    const next = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`
    window.history.replaceState(window.history.state, "", next)
  }, [])

  return null
}
