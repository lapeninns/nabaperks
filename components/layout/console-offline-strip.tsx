"use client"

import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

const readOnline = () => navigator.onLine
const readServerOnline = () => true

/**
 * Mono strip under the console top bar while the browser reports no
 * connection. The QR and team code stay readable from the last loaded view;
 * mutations and the scanner disable themselves with a reason of their own.
 * Server snapshot is "online" so the strip never flashes during hydration.
 */
export function ConsoleOfflineStrip({
  force = false,
}: {
  /** Harness only: render the strip regardless of the browser's state. */
  force?: boolean
}) {
  const online = useSyncExternalStore(subscribe, readOnline, readServerOnline)

  if (online && !force) return null

  return (
    <p
      role="status"
      data-console-offline="true"
      className="mono-meta border-b-2 border-ink bg-paper-deep px-4 py-2 text-center text-ink"
    >
      Offline — showing the last loaded view
    </p>
  )
}
