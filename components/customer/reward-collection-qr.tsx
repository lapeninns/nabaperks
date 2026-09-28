"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { QrFrame, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import {
  rewardQrCacheBustedSrc,
  rewardQrRefreshIntervalMs,
} from "@/lib/customer/reward-qr"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"

/** The one instruction that sits beside the code. */
const SHOW_COLLECTION_CODE_INSTRUCTION = "Show this code to the team."

/**
 * The customer-held reward QR. The encoded scan token has a 10-minute TTL
 * enforced at scan time, so a one-shot image could go stale while a customer
 * queues. This refreshes `qr.png` on an interval inside that TTL — each refresh
 * mints a fresh token (F11). A transient image failure shows a calm banner with
 * a retry instead of a broken-image glyph, and a skeleton holds the framed box
 * until the QR loads (F17).
 *
 * The frame is capped rather than filling the column: at 390×844 the whole code
 * and its instruction sit inside the first screen, and on a short or landscape
 * viewport it steps down to a still-scannable size instead of forcing a scroll.
 * The white quiet zone is the frame's own padding, so it survives every cap.
 */
export function RewardCollectionQr({
  rewardId,
  rewardName,
  idCheckRequired = false,
  qrSrc,
}: {
  rewardId: string
  rewardName: string
  /** The venue still has to check photo ID in person before handing it over. */
  idCheckRequired?: boolean
  /**
   * Image source override for the DB-free dev harness, in the same spirit as
   * {@link StampCollector}'s injected submitters. Production never passes it,
   * so the protected `/reward/[id]/qr.png` route stays the only real source of
   * a scannable token.
   */
  qrSrc?: string
}) {
  // `tick` cache-busts the src on each refresh; bumping it on retry also forces a
  // fresh fetch after an error.
  const [tick, setTick] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  // Consecutive image failures. An expired session mid-queue makes `qr.png`
  // 404 forever, so repeated failures surface a sign-in path instead of an
  // unwinnable retry loop (CUS-P3-10). A successful load resets it.
  const [failCount, setFailCount] = useState(0)
  // A server-rendered image may finish before React attaches onLoad. Reconcile
  // that state at hydration so the placeholder cannot hide a valid QR.
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      setLoaded(true)
      setFailCount(0)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setLoaded(false)
      setErrored(false)
      setTick((value) => value + 1)
    }, rewardQrRefreshIntervalMs())

    return () => clearInterval(timer)
  }, [])

  function retry() {
    setLoaded(false)
    setErrored(false)
    setTick((value) => value + 1)
  }

  const suggestSignIn = failCount >= 2

  return (
    // Landscape (the squat floor) turns the stack into code-left,
    // instruction-right — the same two-column answer the stamp screen gives to
    // a 390px-tall viewport — so the whole frame and what to do with it stay
    // above the fixed tab bar instead of the code being cropped by it.
    <div className="grid gap-3 short:gap-2 squat:flex squat:items-center squat:gap-4">
      {errored ? (
        <StatusBanner
          title="We could not show your reward code"
          tone="warning"
          className="squat:flex-1"
        >
          <span className="grid gap-3">
            <span>Pull down to refresh, or ask a team member.</span>
            {suggestSignIn ? (
              <span>
                Still not showing? You may be signed out on this phone —{" "}
                <Link
                  // The shared helper mirrors load-reward.ts's expired-session
                  // redirect target and routes `next` through safeNextPath.
                  href={customerLoginHref(`/reward/${rewardId}`)}
                  className="font-bold underline underline-offset-4"
                >
                  sign in again
                </Link>{" "}
                to bring it back.
              </span>
            ) : null}
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={retry}
            >
              Show a fresh QR
            </Button>
          </span>
        </StatusBanner>
      ) : (
        <QrFrame
          label={`Collection code for ${rewardName}`}
          className="mx-auto w-full max-w-[21rem] short:max-w-[15rem] squat:w-48 squat:max-w-none squat:shrink-0"
        >
          <div className="relative aspect-square w-full" aria-busy={!loaded}>
            {!loaded ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse rounded-md bg-secondary motion-reduce:animate-none"
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin reward QR is generated by a protected route */}
            <img
              ref={imageRef}
              src={qrSrc ?? rewardQrCacheBustedSrc(rewardId, tick)}
              alt={`QR code for collecting ${rewardName}`}
              className="aspect-square w-full object-contain"
              onLoad={() => {
                setLoaded(true)
                setFailCount(0)
              }}
              onError={() => {
                setErrored(true)
                setFailCount((count) => count + 1)
              }}
            />
          </div>
        </QrFrame>
      )}
      <div className="grid gap-3 short:gap-2 squat:min-w-0 squat:flex-1">
        <p
          data-collection-instruction
          className="rounded-xl bg-secondary px-3 py-2 text-center text-sm font-bold text-foreground squat:text-left"
        >
          {SHOW_COLLECTION_CODE_INSTRUCTION}
        </p>
        {/* The identity requirement belongs beside the code, not behind the
            disclosure: it is what the customer has to have in their hand. */}
        {idCheckRequired ? (
          <StatusBanner title="Photo ID needed" tone="warning">
            Have your photo ID ready. The team checks it before handing your
            reward over.
          </StatusBanner>
        ) : null}
      </div>
    </div>
  )
}
