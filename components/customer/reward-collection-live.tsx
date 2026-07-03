"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { RewardCollectionQr } from "@/components/customer/reward-collection-qr"

/**
 * Live confirmation leaf for a held reward QR. While the screen is open it polls
 * the no-store status endpoint about once a second, checking immediately on
 * mount and again whenever the tab regains focus or visibility. The merchant
 * scan is the only mutation — this leaf only *observes* `reward_events.status`.
 * Once the server confirms the reward is collected it adds the one-shot reward
 * flag, refreshes the server component into the collected proof, and stops
 * polling.
 */
const POLL_INTERVAL_MS = 1500

export function RewardCollectionLive({
  rewardId,
  rewardName,
}: {
  rewardId: string
  rewardName: string
}) {
  const router = useRouter()
  const [redeemed, setRedeemed] = useState(false)

  useEffect(() => {
    if (redeemed) return

    let active = true
    let polling = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    function scheduleNext() {
      if (!active) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(check, POLL_INTERVAL_MS)
    }

    async function check() {
      // Re-entrancy guard: only ever one check in flight. A focus/visibility
      // event that lands mid-request is a no-op — the in-flight check reschedules
      // itself — so the loop can never fork into two and amplify the cadence.
      if (!active || polling) return
      // Pause while backgrounded; a focus/visibility change resumes the loop so
      // a phone left at the counter does not keep polling in a hidden tab.
      if (document.visibilityState === "hidden") return

      polling = true
      controller = new AbortController()
      try {
        const res = await fetch(`/reward/${rewardId}/status`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!active) return
        if (res.ok) {
          const data = (await res.json()) as { redeemed?: boolean }
          if (data.redeemed) {
            setRedeemed(true)
            router.replace(
              `/reward/${encodeURIComponent(rewardId)}?reward=redeemed`,
              { scroll: false }
            )
            router.refresh()
            return
          }
        }
      } catch {
        // Aborted (cleanup) or a transient network error — fall through and
        // reschedule rather than surfacing an error on a passive screen.
        if (!active) return
      } finally {
        polling = false
      }
      scheduleNext()
    }

    function resume() {
      if (active && document.visibilityState === "visible") check()
    }

    check()
    document.addEventListener("visibilitychange", resume)
    window.addEventListener("focus", resume)

    return () => {
      active = false
      polling = false
      if (timer) clearTimeout(timer)
      controller?.abort()
      document.removeEventListener("visibilitychange", resume)
      window.removeEventListener("focus", resume)
    }
  }, [rewardId, redeemed, router])

  return (
    <div className="grid gap-3">
      <RewardCollectionQr rewardId={rewardId} rewardName={rewardName} />
      <p className="sr-only" role="status" aria-live="polite">
        {redeemed
          ? "Reward collected. Updating your screen."
          : "Waiting for the merchant to scan your reward QR."}
      </p>
    </div>
  )
}
