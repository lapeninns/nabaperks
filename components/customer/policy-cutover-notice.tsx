"use client"

import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"

export function PolicyCutoverNotice({
  membershipId,
  issuedAt,
}: {
  readonly membershipId: string
  readonly issuedAt: string
}) {
  const storageKey = `nabaperks:cycle-notice:${membershipId}:${issuedAt}`
  const visible = useSyncExternalStore(
    (notify) => {
      globalThis.addEventListener("storage", notify)
      globalThis.addEventListener("nabaperks:cycle-notice", notify)
      return () => {
        globalThis.removeEventListener("storage", notify)
        globalThis.removeEventListener("nabaperks:cycle-notice", notify)
      }
    },
    () => globalThis.localStorage.getItem(storageKey) !== "dismissed",
    () => true
  )

  if (!visible) return null

  return (
    <aside
      aria-label="Loyalty card update"
      className="grid gap-2 rounded-lg border-2 border-ink bg-seal/15 p-3"
    >
      <p className="text-sm leading-6">
        Your new card is ready. Rewards now stay in your wallet while you collect
        stamps on the next card.
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-fit"
        onClick={() => {
          globalThis.localStorage.setItem(storageKey, "dismissed")
          globalThis.dispatchEvent(new Event("nabaperks:cycle-notice"))
        }}
      >
        Dismiss
      </Button>
    </aside>
  )
}
