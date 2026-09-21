"use client"

import { useEffect, useState } from "react"

import { formatConsoleDate } from "@/lib/merchant/console-date"

/**
 * The top bar's date. Server-rendered from the request so hydration matches,
 * then, when `live`, re-read once a minute so a till console left open across
 * midnight rolls over to the new London day without a reload. The harness
 * leaves `live` off so screenshots stay byte-stable.
 */
export function ConsoleTopBarDate({
  initial,
  live = false,
}: {
  initial: string
  live?: boolean
}) {
  const [label, setLabel] = useState(initial)

  useEffect(() => {
    if (!live) return
    const tick = () => setLabel(formatConsoleDate(new Date()))
    tick()
    const interval = window.setInterval(tick, 60_000)
    return () => window.clearInterval(interval)
  }, [live])

  return <p className="mono-meta shrink-0 text-ink-soft">{label}</p>
}
