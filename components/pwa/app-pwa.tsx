"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { isMerchantAuthRoute } from "@/lib/pwa/app-pwa-routes"
import { cn } from "@/lib/utils"

type InstallOutcome = "accepted" | "dismissed"

type InstallChoice = {
  readonly outcome: InstallOutcome
  readonly platform: string
}

type BeforeInstallPromptEvent = Event & {
  readonly platforms: readonly string[]
  readonly userChoice: Promise<InstallChoice>
  prompt: () => Promise<void>
}

type AppSurface = "admin" | "customer" | "marketing" | "merchant"

type InstallCopy = { readonly title: string; readonly description: string }

const DISMISS_STORAGE_KEY = "nabaperks:pwa-install-dismissed:v2"
const CUSTOMER_PREFIXES = ["/home", "/card", "/reward", "/m", "/q"] as const
const MERCHANT_PREFIXES = ["/app"] as const
const IOS_INSTALL_DESCRIPTION =
  "On iPhone, open Safari's Share menu, then choose Add to Home Screen."
const INSTALL_COPY = {
  admin: {
    title: "Install Nabaperks admin",
    description: "Open support tools from your device without finding a tab.",
  },
  customer: {
    title: "Install My Nabaperks",
    description: "Keep your loyalty cards one tap from the home screen.",
  },
  marketing: {
    title: "Install Nabaperks",
    description: "Keep Nabaperks handy on this device.",
  },
  merchant: {
    title: "Install Nabaperks merchant",
    description: "Keep the counter console ready on this device.",
  },
} as const satisfies Record<AppSurface, InstallCopy>

function isBeforeInstallPromptEvent(
  event: Event
): event is BeforeInstallPromptEvent {
  return "prompt" in event && "userChoice" in event
}

function routeSurface(pathname: string): AppSurface {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin"
  }

  if (MERCHANT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "merchant"
  }

  if (CUSTOMER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "customer"
  }

  return "marketing"
}

/**
 * Routes that render the fixed `CustomerTabBar` (the card/reward experience
 * and the authed home shell). The install prompt lifts above the bar there so
 * it never floats over the tabs' top edge (VCU-P3-13). `/scan` stays at the
 * default offset: its most common, unauthenticated state has no tab bar.
 */
/**
 * The member's two transactional moments: the stamp disc at the counter and any
 * screen whose whole job is to hold a scannable code up to a phone or a
 * scanner. `/app/launch` is already excluded for exactly this reason; these
 * carry the same claim on the bottom of the screen, and an optional install
 * nudge that covers the stamp button or the reward QR is the worst possible
 * moment to ask (CUS 02#69). `/scan` is included because `hasCustomerTabBar`
 * deliberately leaves it at the default offset, which puts the card straight
 * over the scanner's own exits.
 */
function isCustomerTransactionalRoute(pathname: string): boolean {
  return (
    pathname === "/scan" ||
    pathname.startsWith("/reward/") ||
    pathname.startsWith("/pass/") ||
    (pathname.startsWith("/card/") && pathname.endsWith("/stamp"))
  )
}

function hasCustomerTabBar(pathname: string): boolean {
  if (pathname.startsWith("/card/") || pathname.startsWith("/reward/")) {
    return true
  }

  if (pathname === "/home" || pathname.startsWith("/home/")) {
    return pathname !== "/home/login"
  }

  return false
}

function readDismissedPreference(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1"
  } catch (error) {
    if (error instanceof DOMException) {
      return false
    }

    throw error
  }
}

function writeDismissedPreference(): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "1")
  } catch (error) {
    if (error instanceof DOMException) {
      return
    }

    throw error
  }
}

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  )
}

function isAppleStandalone(): boolean {
  return (
    "standalone" in window.navigator && window.navigator.standalone === true
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return target.matches("input, textarea, select, [contenteditable='true']")
}

export function AppPwa() {
  const pathname = usePathname()
  const [hasMounted, setHasMounted] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isEditingText, setIsEditingText] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const surface = useMemo(() => routeSurface(pathname), [pathname])
  const copy = useMemo(() => INSTALL_COPY[surface], [surface])

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)")
    const syncBrowserState = () => {
      setHasMounted(true)
      setIsIos(isIosDevice())
      setDismissed(readDismissedPreference())
      setIsStandalone(displayModeQuery.matches || isAppleStandalone())
    }
    const browserStateTimer = window.setTimeout(syncBrowserState, 0)
    let serviceWorkerTimer: number | null = null
    let serviceWorkerIdleHandle: number | null = null

    const registerServiceWorker = () => {
      void window.navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error: unknown) => {
          if (!(error instanceof Error)) throw error
        })
    }

    const scheduleServiceWorkerRegistration = () => {
      if (!("serviceWorker" in window.navigator)) return

      if (typeof window.requestIdleCallback === "function") {
        serviceWorkerIdleHandle = window.requestIdleCallback(
          registerServiceWorker
        )
        return
      }

      serviceWorkerTimer = window.setTimeout(registerServiceWorker, 1)
    }

    if (document.readyState === "complete") {
      scheduleServiceWorkerRegistration()
    } else {
      window.addEventListener("load", scheduleServiceWorkerRegistration, {
        once: true,
      })
    }

    const updateStandaloneState = () => {
      setIsStandalone(displayModeQuery.matches || isAppleStandalone())
    }

    displayModeQuery.addEventListener("change", updateStandaloneState)

    return () => {
      window.clearTimeout(browserStateTimer)
      window.removeEventListener("load", scheduleServiceWorkerRegistration)
      if (serviceWorkerIdleHandle !== null)
        window.cancelIdleCallback(serviceWorkerIdleHandle)
      if (serviceWorkerTimer !== null) window.clearTimeout(serviceWorkerTimer)
      displayModeQuery.removeEventListener("change", updateStandaloneState)
    }
  }, [])

  useEffect(() => {
    let focusOutTimer: number | null = null
    const updateEditingState = () => {
      focusOutTimer = null
      setIsEditingText(isEditableTarget(document.activeElement))
    }
    const onFocusIn = (event: FocusEvent) => {
      setIsEditingText(isEditableTarget(event.target))
    }
    const onFocusOut = () => {
      if (focusOutTimer !== null) window.clearTimeout(focusOutTimer)
      focusOutTimer = window.setTimeout(updateEditingState, 0)
    }

    window.addEventListener("focusin", onFocusIn)
    window.addEventListener("focusout", onFocusOut)

    return () => {
      if (focusOutTimer !== null) window.clearTimeout(focusOutTimer)
      window.removeEventListener("focusin", onFocusIn)
      window.removeEventListener("focusout", onFocusOut)
    }
  }, [])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return

      event.preventDefault()
      setDeferredPrompt(event)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    }
  }, [])

  if (
    !hasMounted ||
    pathname === "/offline" ||
    pathname.startsWith("/m/") ||
    isMerchantAuthRoute(pathname) ||
    // Setup owns the phone's bottom action area. Deferring the optional install
    // prompt keeps it from covering the reward batch tray or another launch CTA.
    pathname === "/app/launch" ||
    // The stamp disc and the scannable codes own the bottom of the screen for
    // the seconds they are in use.
    isCustomerTransactionalRoute(pathname) ||
    // Marketing routes never prompt — except /start, the manifest start_url
    // and customer switchboard, where the install offer is the point (this is
    // what makes INSTALL_COPY.marketing reachable).
    (surface === "marketing" && pathname !== "/start") ||
    isStandalone ||
    isEditingText ||
    dismissed
  ) {
    return null
  }
  if (!deferredPrompt && !isIos) return null

  async function install(): Promise<void> {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  function dismiss(): void {
    writeDismissedPreference()
    setDismissed(true)
  }

  return (
    <aside
      aria-label="Install Nabaperks"
      className={cn(
        // shadow-md, not shadow-xs: this floats above the page, and every
        // other floating surface in the system carries the 4px offset.
        "fixed right-3 left-3 z-50 mx-auto grid max-w-md gap-3 rounded-lg border-2 border-ink bg-card p-4 text-foreground shadow-md sm:right-5 sm:left-auto sm:w-[24rem]",
        // Above the fixed customer tab bar (56px bar + border + breathing
        // room) instead of floating over its top edge (VCU-P3-13).
        hasCustomerTabBar(pathname)
          ? "bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]"
          : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-base leading-none font-extrabold text-primary-foreground shadow-xs"
        >
          {/* Same glyph as the brand Logo roundel. */}✱
        </span>
        <div className="grid gap-1">
          <p className="text-sm leading-tight font-extrabold">{copy.title}</p>
          <p className="text-sm leading-5 text-muted-foreground">
            {isIos ? IOS_INSTALL_DESCRIPTION : copy.description}
          </p>
        </div>
      </div>
      {/* The chips were `rounded-md border border-ink/20`: a 6px radius and a
          1px border at a third ink alpha, in a system that is 10px and 2px
          everywhere else — the most OS-like surface in the product was the one
          that least looked like it (CUS 02#70). */}
      {isIos && !deferredPrompt ? (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <span className="rounded-lg border-2 border-line bg-secondary px-3 py-2">
            1. Tap Share
          </span>
          <span className="rounded-lg border-2 border-line bg-secondary px-3 py-2">
            2. Add to Home Screen
          </span>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Not now
        </Button>
        {deferredPrompt ? (
          <Button type="button" size="sm" onClick={install}>
            Install
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
