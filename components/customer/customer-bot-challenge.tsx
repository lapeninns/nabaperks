"use client"

import Script from "next/script"
import { useEffect, useRef, useState } from "react"

type TurnstileWindow = Window & {
  turnstile?: {
    render(
      container: HTMLElement,
      options: {
        sitekey: string
        action: string
        appearance: "interaction-only"
        size: "flexible"
        theme: "auto"
      }
    ): string
    remove(widgetId: string): void
  }
}

export function CustomerBotChallenge({
  siteKey,
  resetKey,
}: {
  siteKey?: string
  resetKey?: unknown
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const turnstile = (window as TurnstileWindow).turnstile
    const container = containerRef.current
    if (!siteKey || !ready || !turnstile || !container) return

    if (widgetRef.current) turnstile.remove(widgetRef.current)
    widgetRef.current = turnstile.render(container, {
      sitekey: siteKey,
      action: "customer_phone_otp",
      appearance: "interaction-only",
      size: "flexible",
      theme: "auto",
    })

    return () => {
      if (!widgetRef.current) return
      turnstile.remove(widgetRef.current)
      widgetRef.current = null
    }
  }, [ready, resetKey, siteKey])

  if (!siteKey) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} className="min-h-16" />
    </>
  )
}
