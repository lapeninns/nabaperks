"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"

export function LaunchTransientQueryCleanup({
  cleanHref,
}: {
  cleanHref: string | null
}) {
  const router = useRouter()

  useEffect(() => {
    if (!cleanHref) {
      return
    }

    router.replace(cleanHref, { scroll: false })
  }, [cleanHref, router])

  return null
}

export function LaunchSaveNextAction({
  nextHref,
  nextLabel,
  stayHref,
  blockedReason,
}: {
  nextHref: string | null
  nextLabel: string
  stayHref: string
  blockedReason?: string
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
              Continue to {nextLabel}
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
