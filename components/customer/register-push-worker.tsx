"use client"

import { useEffect } from "react"

/**
 * Registers the push-only service worker after the page has loaded.
 * Keeping the script at /sw.js lets an already-installed app-shell worker
 * update, clear its caches, and stop intercepting navigations.
 */
export function RegisterPushWorker() {
  useEffect(() => {
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

    return () => {
      window.removeEventListener("load", scheduleServiceWorkerRegistration)
      if (serviceWorkerIdleHandle !== null) {
        window.cancelIdleCallback(serviceWorkerIdleHandle)
      }
      if (serviceWorkerTimer !== null) window.clearTimeout(serviceWorkerTimer)
    }
  }, [])

  return null
}
