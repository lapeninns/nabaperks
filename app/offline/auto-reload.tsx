"use client"

import { useEffect } from "react"

/**
 * OfflineAutoReload — reloads the page the moment the connection returns, so
 * the cached offline fallback never sits in front of a working network. The
 * service worker pre-caches this page's script chunks with its CSS, so the
 * listener is live even when the page is served from the offline shell.
 * Renders nothing.
 */
export function OfflineAutoReload() {
  useEffect(() => {
    const reload = () => window.location.reload()
    window.addEventListener("online", reload)
    return () => window.removeEventListener("online", reload)
  }, [])

  return null
}
