"use client"

import { useEffect, useState } from "react"

/**
 * OfflineAutoReload — reloads the page the moment the connection returns, so
 * the cached offline fallback never sits in front of a working network. The
 * service worker pre-caches this page's script chunks with its CSS, so the
 * listener is live even when the page is served from the offline shell.
 *
 * It also renders the connection status as a polite live region: pressing
 * "Try again" while still offline previously gave no feedback at all, because
 * the retry navigation simply serves the same fallback page.
 */
export function OfflineAutoReload() {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const reload = () => window.location.reload()
    const sync = () => setOnline(window.navigator.onLine)

    sync()
    window.addEventListener("online", reload)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", reload)
      window.removeEventListener("offline", sync)
    }
  }, [])

  return (
    <p
      aria-live="polite"
      className="mono-meta fixed inset-x-0 bottom-4 text-center text-muted-foreground"
    >
      {online === null
        ? ""
        : online
          ? "Back online — reloading"
          : "Still offline"}
    </p>
  )
}
