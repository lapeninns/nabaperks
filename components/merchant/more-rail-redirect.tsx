"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * From 900px the rail exposes every More destination, so /app/more is dead
 * weight there (handoff §7.5). The viewport is only known in the browser,
 * hence a client redirect on mount and on crossing the breakpoint, handled
 * by the page rather than middleware.
 */
export function MoreRailRedirect({ to = "/app" }: { to?: string }) {
  const router = useRouter()

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)")
    const check = () => {
      if (media.matches) router.replace(to)
    }
    check()
    media.addEventListener("change", check)
    return () => media.removeEventListener("change", check)
  }, [router, to])

  return null
}
