"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"

export function LaunchTransientQueryCleanup({
  cleanHref,
}: {
  cleanHref: string | null
}) {
  useEffect(() => {
    if (!cleanHref) {
      return
    }

    // Scrub the one-shot success params from the URL *without* an RSC refetch.
    // `router.replace` would re-render this force-dynamic page without the
    // saved/seeded/created/enabled/qr params and blank the just-shown success
    // banner; `history.replaceState` only rewrites the address bar, leaving the
    // already-rendered tree (and its banner) intact. Passing the current
    // history state keeps Next's App Router navigation state consistent.
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", cleanHref)
    }
  }, [cleanHref])

  return null
}

export function LaunchSaveNextAction({
  nextHref,
  nextLabel,
  stayHref,
  blockedReason,
  primaryLabel,
}: {
  nextHref: string | null
  nextLabel: string
  stayHref: string
  blockedReason?: string
  primaryLabel?: string
}) {
  return (
    <div className="mt-3 grid gap-3">
      {blockedReason ? (
        <p className="text-sm leading-6 opacity-90">{blockedReason}</p>
      ) : (
        <p className="text-sm leading-6 opacity-90">
          Saved. Continue when you are ready, or stay here to review.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {nextHref ? (
          <Button asChild size="sm">
            <Link href={nextHref}>
              {primaryLabel ?? `Continue to ${nextLabel}`}
              <Icon icon={ArrowRight02Icon} size={15} />
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link href={stayHref}>Stay on this step</Link>
        </Button>
      </div>
    </div>
  )
}
