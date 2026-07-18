"use client"

import { useEffect, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

import {
  parseFunnelCaptureResponse,
  type PublicFunnelEvent,
} from "@/lib/analytics/funnel-contract"
import { createFunnelCaptureQueue } from "@/lib/analytics/funnel-capture-queue"

const FUNNEL_SESSION_KEY = "nabaperks:analytics:funnel-token"

const funnelTokenListeners = new Set<() => void>()
const funnelCaptureQueue = createFunnelCaptureQueue({
  postCapture: postFunnelCapture,
  readToken: readFunnelToken,
  rememberToken: rememberFunnelToken,
})

export function MarketingFunnelTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const event = pageViewEvent(pathname)
    if (event) void captureMarketingFunnelEvent(event)
  }, [pathname])

  return null
}

export function useMarketingFunnelToken(): string | null {
  return useSyncExternalStore(
    subscribeToFunnelToken,
    readFunnelToken,
    readServerFunnelToken
  )
}

export function captureMarketingFunnelEvent(
  event: PublicFunnelEvent
): Promise<void> {
  return funnelCaptureQueue.capture(event)
}

async function postFunnelCapture(
  event: PublicFunnelEvent,
  token?: string | null
) {
  const response = await fetch("/api/analytics/funnel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, ...(token ? { token } : {}) }),
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
  })
  if (!response.ok) return null

  return parseFunnelCaptureResponse(await response.json())
}

function pageViewEvent(pathname: string): PublicFunnelEvent | null {
  if (pathname === "/signup") return "merchant_signup_started"
  if (pathname === "/signup/verify") {
    return "merchant_otp_verification_viewed"
  }
  return null
}

function readFunnelToken(): string | null {
  try {
    return sessionStorage.getItem(FUNNEL_SESSION_KEY)
  } catch {
    return null
  }
}

function rememberFunnelToken(token: string) {
  try {
    sessionStorage.setItem(FUNNEL_SESSION_KEY, token)
    for (const listener of funnelTokenListeners) listener()
    return true
  } catch {
    // Storage is optional. Do not retain a hidden module-global identity when
    // the browser or merchant has blocked session persistence.
    return false
  }
}

function subscribeToFunnelToken(listener: () => void) {
  funnelTokenListeners.add(listener)
  return () => funnelTokenListeners.delete(listener)
}

function readServerFunnelToken() {
  return null
}
