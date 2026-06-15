"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"

import { redemptionStatusAction } from "@/app/reward/[rewardId]/actions"
import { RewardTicket, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import type {
  RedemptionTokenView,
  RewardView,
} from "@/lib/customer/experience/types"

type RewardQrPanelProps = {
  readonly reward: RewardView
  readonly merchantName: string
  readonly token: RedemptionTokenView
  readonly terms: ReactNode
}

type PollStatus = "pending" | "consumed" | "expired" | "none"

export function RewardQrPanel({
  reward,
  merchantName,
  token,
  terms,
}: RewardQrPanelProps) {
  const [status, setStatus] = useState<PollStatus>("pending")
  const [now, setNow] = useState(() => Date.now())
  const expiresAt = useMemo(
    () => new Date(token.expiresAt).getTime(),
    [token.expiresAt]
  )
  const secondsRemaining = Math.max(0, Math.ceil((expiresAt - now) / 1000))

  useEffect(() => {
    const countdown = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(countdown)
  }, [])

  useEffect(() => {
    let active = true

    async function pollStatus() {
      const result = await redemptionStatusAction(reward.rewardId)
      if (!active) return

      setStatus(result.status)
    }

    void pollStatus()
    const poll = window.setInterval(() => {
      void pollStatus()
    }, 3_000)

    return () => {
      active = false
      window.clearInterval(poll)
    }
  }, [reward.rewardId])

  if (status === "consumed") {
    return (
      <>
        <RewardTicket
          state="redeemed"
          name={reward.rewardName}
          description={terms}
        />
        <StatusBanner title="Reward redeemed." tone="success">
          {merchantName} has confirmed this reward. A new stamp cycle has
          started.
        </StatusBanner>
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link href={`/card/${reward.membershipId}`}>Back to card</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <RewardTicket
        state="ready"
        name={reward.rewardName}
        description={terms}
      />
      <div className="shadow-soft grid gap-3 rounded-2xl border-2 border-ink bg-white p-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- route returns a customer-owned dynamic QR PNG */}
        <img
          src={token.qrImageUrl}
          alt={`One-time redemption QR for ${reward.rewardName}`}
          className="mx-auto aspect-square w-full max-w-72 rounded-xl bg-white"
        />
        <div className="grid gap-1">
          <p className="text-sm font-black text-foreground">
            Show QR at counter
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Waiting for staff to scan. This QR expires in{" "}
            <span className="font-bold text-foreground">
              {formatDuration(secondsRemaining)}
            </span>
            .
          </p>
        </div>
        <code className="overflow-hidden rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-foreground">
          {token.redeemUrl}
        </code>
      </div>
      {status === "expired" || secondsRemaining <= 0 ? (
        <StatusBanner title="QR expired." tone="warning">
          Refresh this reward screen to issue a new one-time QR.
        </StatusBanner>
      ) : (
        <StatusBanner title="Ready for merchant scan." tone="success">
          Keep this screen open until {merchantName} confirms the reward.
        </StatusBanner>
      )}
    </>
  )
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
