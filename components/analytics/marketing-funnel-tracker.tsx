"use client"

import { useEffect, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

import {
  parseFunnelCaptureResponse,
  type PublicFunnelEvent,
} from "@/lib/analytics/funnel-contract"

const FUNNEL_SESSION_KEY = "nabaperks:analytics:funnel-token"

let captureQueue: Promise<string | null> = Promise.resolve(null)
const funnelTokenListeners = new Set<() => void>()

export function MarketingFunnelTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const event = pageViewEvent(pathname)
    if (event) void captureMarketingFunnelEvent(event)
  }, [pathname])

  useEffect(() => {
    const captureSignupClick = (event: MouseEvent) => {
      if (pathname !== "/" || !isSameOriginSignupLink(event.target)) return
      void captureMarketingFunnelEvent("merchant_signup_clicked")
    }

    document.addEventListener("click", captureSignupClick, { capture: true })
    return () =>
      document.removeEventListener("click", captureSignupClick, {
        capture: true,
      })
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
  event: PublicFunnelEvent,
  funnelToken?: string | null
): Promise<string | null> {
  const queuedCapture = captureQueue.then(async (previousToken) => {
    const token =
      funnelToken === undefined
        ? (readFunnelToken() ?? previousToken)
        : funnelToken

    try {
      const result = await postFunnelCapture(event, token)
      if (!result) return token ?? null

      if (token) {
        return rememberFunnelToken(result.token) ? result.token : null
      }

      // The no-token request only issues identity. Persist it before asking the
      // server to record the milestone, so a lost record response retries with
      // the same deterministic event UUID instead of creating an orphan row.
      if (!rememberFunnelToken(result.token)) return null
      const recorded = await postFunnelCapture(event, result.token)
      if (!recorded) return result.token
      return rememberFunnelToken(recorded.token) ? recorded.token : null
    } catch {
      return token ?? null
    }
  })

  captureQueue = queuedCapture.catch(() => readFunnelToken())
  return queuedCapture
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
  if (pathname === "/") return "merchant_marketing_viewed"
  if (pathname === "/signup") return "merchant_signup_started"
  if (pathname === "/signup/verify") {
    return "merchant_otp_verification_viewed"
  }
  return null
}

function isSameOriginSignupLink(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false

  const link = target.closest<HTMLAnchorElement>("a[href]")
  if (!link || link.hasAttribute("download")) return false

  try {
    const destination = new URL(link.href, window.location.href)
    return (
      destination.origin === window.location.origin &&
      destination.pathname === "/signup"
    )
  } catch {
    return false
  }
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
