"use client"

import { useEffect, useState } from "react"

import { phoneCodeEmailFallbackWaitMs } from "@/lib/customer/phone-code-email-fallback"

/**
 * True once a phone code step may offer email instead: `inSeconds` (the
 * server's seconds left) after the step appears. `undefined` never offers it.
 *
 * The server render and hydration both start hidden. The countdown uses the
 * wait the step appeared with: a later answer on the same step (a wrong code,
 * a resend) keeps it running rather than restarting it. Once shown it stays
 * shown.
 */
export function useEmailFallbackReady(inSeconds: number | undefined): boolean {
  const [ready, setReady] = useState(false)
  const [wait] = useState(inSeconds)

  useEffect(() => {
    if (wait === undefined) return
    const timer = window.setTimeout(
      () => setReady(true),
      phoneCodeEmailFallbackWaitMs(wait)
    )
    return () => window.clearTimeout(timer)
  }, [wait])

  return ready
}
