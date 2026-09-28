"use client"

import { useEffect, useState } from "react"

import { phoneCodeEmailFallbackWaitMs } from "@/lib/customer/phone-code-email-fallback"

/**
 * True once a phone code step may offer email instead: at `availableAt`
 * (epoch seconds, from the server's send time). `undefined` never offers it.
 *
 * The server render and hydration both start hidden; the client clock decides
 * after mount. Once shown it stays shown, so a resend that restarts the
 * server's wait does not take the fallback away from someone already reading
 * it.
 */
export function useEmailFallbackReady(
  availableAt: number | undefined
): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (ready || availableAt === undefined) return
    const timer = window.setTimeout(
      () => setReady(true),
      phoneCodeEmailFallbackWaitMs(availableAt, Date.now())
    )
    return () => window.clearTimeout(timer)
  }, [availableAt, ready])

  return ready
}
