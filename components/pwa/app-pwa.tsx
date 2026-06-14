"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"

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

type InstallCopy = {
  readonly title: string
  readonly description: string
}

const DISMISS_STORAGE_KEY = "nabaperks:pwa-install-dismissed:v2"
const CUSTOMER_PREFIXES = ["/home", "/card", "/reward", "/m", "/q"] as const
const MERCHANT_PREFIXES = ["/app", "/login", "/signup"] as const
const IOS_INSTALL_DESCRIPTION =
  "On iPhone, open Safari's Share menu, then choose Add to Home Screen."

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

function installCopy(surface: AppSurface): InstallCopy {
  switch (surface) {
    case "admin":
      return {
        title: "Install Nabaperks admin",
        description:
          "Open support tools from your device without finding a tab.",
      }
    case "customer":
      return {
        title: "Install My Nabaperks",
        description: "Keep your loyalty cards one tap from the home screen.",
      }
    case "merchant":
      return {
        title: "Install Nabaperks merchant",
        description: "Keep the counter console ready on this device.",
      }
    case "marketing":
      return {
        title: "Install Nabaperks",
        description: "Keep Nabaperks handy on this device.",
      }
  }
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
  const navigator = window.navigator as Navigator & {
    readonly standalone?: boolean
  }

  return navigator.standalone === true
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

  const copy = useMemo(() => installCopy(routeSurface(pathname)), [pathname])

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)")
    const syncBrowserState = () => {
      setHasMounted(true)
      setIsIos(isIosDevice())
      setDismissed(readDismissedPreference())
      setIsStandalone(displayModeQuery.matches || isAppleStandalone())
    }
    const browserStateTimer = window.setTimeout(syncBrowserState, 0)

    async function registerServiceWorker(): Promise<void> {
      try {
        await window.navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
      } catch (error) {
        if (error instanceof Error) {
          return
        }

        throw error
      }
    }

    if ("serviceWorker" in window.navigator) {
      void registerServiceWorker()
    }

    const updateStandaloneState = () => {
      setIsStandalone(displayModeQuery.matches || isAppleStandalone())
    }

    displayModeQuery.addEventListener("change", updateStandaloneState)

    return () => {
      window.clearTimeout(browserStateTimer)
      displayModeQuery.removeEventListener("change", updateStandaloneState)
    }
  }, [])

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      setIsEditingText(isEditableTarget(event.target))
    }
    const onFocusOut = () => {
      window.setTimeout(() => {
        setIsEditingText(isEditableTarget(document.activeElement))
      }, 0)
    }

    window.addEventListener("focusin", onFocusIn)
    window.addEventListener("focusout", onFocusOut)

    return () => {
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
      className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-50 mx-auto grid max-w-md gap-3 rounded-lg border-2 border-ink bg-card p-4 text-foreground shadow-xs sm:right-5 sm:left-auto sm:w-[24rem]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary text-base leading-none font-extrabold text-primary-foreground shadow-xs"
        >
          *
        </span>
        <div className="grid gap-1">
          <p className="text-sm leading-tight font-extrabold">{copy.title}</p>
          <p className="text-sm leading-5 text-muted-foreground">
            {isIos ? IOS_INSTALL_DESCRIPTION : copy.description}
          </p>
        </div>
      </div>
      {isIos && !deferredPrompt ? (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <span className="rounded-md border border-ink/20 bg-secondary px-3 py-2">
            1. Tap Share
          </span>
          <span className="rounded-md border border-ink/20 bg-secondary px-3 py-2">
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
