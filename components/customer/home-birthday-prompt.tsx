"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "nabaperks.dob-prompt-dismissed"
const RESHOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000

// A tiny external store over the localStorage dismissal flag. useSyncExternalStore
// (not useState + effect) reads the client-only value without a hydration flash
// and without the banned setState-in-effect.
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function shouldShow(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return true
    const dismissedAt = Number(raw)
    return (
      !Number.isFinite(dismissedAt) ||
      Date.now() - dismissedAt > RESHOW_AFTER_MS
    )
  } catch {
    return true
  }
}

/** The server never has localStorage; render hidden and let the client hydrate. */
function serverSnapshot() {
  return false
}

/**
 * A quiet, dismissible nudge (rendered only when the member has no stored DOB)
 * to add a birthday so venues can send a birthday treat. Never blocks the
 * dashboard; a dismissal is remembered for 30 days.
 */
export function HomeBirthdayPrompt() {
  const visible = useSyncExternalStore(subscribe, shouldShow, serverSnapshot)

  if (!visible) return null

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Storage can be unavailable; the notify below still hides it this session.
    }
    for (const listener of listeners) listener()
  }

  return (
    <ReceiptCard className="grid gap-3">
      <MonoTag tone="sun">Birthday treat</MonoTag>
      <h2 className="text-base leading-tight font-extrabold">
        Add your birthday for a treat on us
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        Some venues give members a reward during their birthday month. Add yours
        and you won&rsquo;t miss it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/home/profile">Add your birthday</Link>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </ReceiptCard>
  )
}
