"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

type StampCodePanelProps = {
  tokenId: string
  code: string
  expiresAt: string
  kind: "stamp" | "redeem"
  doneHref: string
}

type PanelPhase = "waiting" | "approved" | "expired" | "replaced"

const POLL_INTERVAL_MS = 2000

export function StampCodePanel({
  tokenId,
  code,
  expiresAt,
  kind,
  doneHref,
}: StampCodePanelProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<PanelPhase>("waiting")
  const [countdown, setCountdown] = useState(() => secondsLeft(expiresAt))
  const redirected = useRef(false)

  // Countdown to expiry, ticking once a second.
  useEffect(() => {
    if (phase !== "waiting") return

    const id = setInterval(() => {
      const left = secondsLeft(expiresAt)
      setCountdown(left)

      if (left <= 0) {
        setPhase("expired")
        clearInterval(id)
      }
    }, 1000)

    return () => clearInterval(id)
  }, [expiresAt, phase])

  // Poll the token status so the card updates without a page refresh.
  useEffect(() => {
    if (phase !== "waiting") return

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch(`/api/tokens/${tokenId}`, {
          cache: "no-store",
        })

        if (!response.ok || cancelled) return

        const payload = (await response.json()) as { status?: string }

        if (payload.status === "approved" && !redirected.current) {
          redirected.current = true
          setPhase("approved")
          router.push(doneHref)
          router.refresh()
        } else if (payload.status === "expired") {
          setPhase("expired")
        } else if (payload.status === "cancelled") {
          setPhase("replaced")
        }
      } catch {
        // Weak Wi-Fi: keep polling; the countdown still guards expiry.
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS)
    void poll()

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [doneHref, phase, router, tokenId])

  if (phase === "approved") {
    return (
      <div
        className="grid gap-3 rounded-2xl border-2 border-ink bg-card p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-2xl font-extrabold leading-tight">
          {kind === "stamp" ? "Stamp landed." : "Reward redeemed."}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Taking you back to your card...
        </p>
      </div>
    )
  }

  if (phase === "expired" || phase === "replaced") {
    return (
      <div
        className="grid gap-4 rounded-2xl border-2 border-ink bg-card p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-2xl font-extrabold leading-tight">
          {phase === "expired" ? "Code expired" : "Code replaced"}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {phase === "expired"
            ? "Codes only live for a couple of minutes. Grab a fresh one."
            : "A newer code was created for this card. Grab a fresh one."}
        </p>
        <Button type="button" size="lg" onClick={() => router.refresh()}>
          Get a new code
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 rounded-2xl border-2 border-ink bg-ink p-6 text-center text-paper">
      <p className="font-mono text-[11px] uppercase tracking-wide text-paper/60">
        {kind === "stamp" ? "Show this code to staff" : "Show this at the counter"}
      </p>
      <p
        className="font-mono text-6xl font-bold uppercase tracking-[0.3em]"
        aria-label={`Your code is ${code.split("").join(" ")}`}
      >
        {code}
      </p>
      <p
        className="font-mono text-xs uppercase tracking-wide text-paper/75"
        role="timer"
        aria-live="polite"
      >
        Expires in {formatCountdown(countdown)}
      </p>
      <p className="mx-auto max-w-[30ch] text-sm leading-6 text-paper/75">
        {kind === "stamp"
          ? "Staff approve it on the counter — keep hold of your phone."
          : "Staff confirm the reward on the counter — keep hold of your phone."}
      </p>
    </div>
  )
}

function secondsLeft(expiresAt: string) {
  return Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)
  )
}

function formatCountdown(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, "0")

  return `${minutes}:${seconds}`
}
