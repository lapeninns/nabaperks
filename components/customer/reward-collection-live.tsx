"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { RewardCollectionQr } from "@/components/customer/reward-collection-qr"
import {
  isTerminalRewardStatusResponse,
  rewardCollectionPollDelay,
} from "@/lib/customer/reward-collection-poll"

/**
 * Live confirmation leaf for a held reward QR. While the screen is open it polls
 * the no-store status endpoint, checking immediately on mount and again
 * whenever the tab regains focus or visibility. The cadence is bounded (see
 * {@link rewardCollectionPollDelay}): brisk at first, slower after a while, and
 * paused after a ceiling until focus or visibility starts a fresh window. A 401
 * or 404 stops the poll for good. The merchant scan is the only mutation — this
 * leaf only *observes* `reward_events.status`. Once the server confirms the
 * reward is collected it adds the one-shot reward flag, refreshes the server
 * component into the collected proof, and stops polling.
 */

export function RewardCollectionLive({
  rewardId,
  rewardName,
  idCheckRequired = false,
  qrSrc,
  poll = true,
}: {
  rewardId: string
  rewardName: string
  /** Passed through so the photo-ID requirement stays beside the code. */
  idCheckRequired?: boolean
  /** Harness-only QR source override — see {@link RewardCollectionQr}. */
  qrSrc?: string
  poll?: boolean
}) {
  const router = useRouter()
  const [redeemed, setRedeemed] = useState(false)

  useEffect(() => {
    if (redeemed || !poll) return

    let active = true
    let polling = false
    // Set on a response retrying cannot change (signed out, not this reward).
    let stopped = false
    let windowStartedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    function scheduleNext() {
      if (!active || stopped) return
      if (timer) clearTimeout(timer)
      timer = undefined
      const delay = rewardCollectionPollDelay(Date.now() - windowStartedAt)
      // Window spent: wait for focus or visibility to start a fresh one.
      if (delay === null) return
      timer = setTimeout(check, delay)
    }

    async function check() {
      // Re-entrancy guard: only ever one check in flight. A focus/visibility
      // event that lands mid-request is a no-op — the in-flight check reschedules
      // itself — so the loop can never fork into two and amplify the cadence.
      if (!active || polling) return
      if (stopped) return
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
        if (isTerminalRewardStatusResponse(res.status)) {
          stopped = true
          return
        }
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
      if (!active || stopped) return
      if (document.visibilityState === "visible") {
        windowStartedAt = Date.now()
        check()
      }
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
  }, [poll, rewardId, redeemed, router])

  return (
    <div className="grid gap-3 short:gap-2">
      <RewardCollectionQr
        rewardId={rewardId}
        rewardName={rewardName}
        idCheckRequired={idCheckRequired}
        qrSrc={qrSrc}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {redeemed
          ? "Reward collected. Updating your screen."
          : "Waiting for the team to scan your collection code."}
      </p>
    </div>
  )
}
