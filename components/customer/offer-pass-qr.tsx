"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { PresentCodeButton } from "@/components/customer/present-code-button"
import { QrFrame, StatusBanner } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { customerLoginHref } from "@/lib/navigation/safe-next-path"
import {
  offerPassQrCacheBustedSrc,
  offerPassQrRefreshIntervalMs,
} from "@/lib/offers/pass-qr"

/**
 * The customer-held discount-pass QR.
 *
 * The code inside the image is a single-use scan token with a ten-minute life
 * (`offer_pass_scan_tokens.expires_at`, mirrored by
 * `OFFER_PASS_SCAN_TOKEN_TTL_MS`). A one-shot image would therefore go stale
 * while a member queues, so this refetches `qr.png` every half TTL — inside the
 * five-minute floor the mint RPC reuses a token down to, which means a
 * presented code always has at least one refresh of life left in it.
 *
 * The pass itself is never consumed. Redeeming burns the code, not the pass, so
 * a member can show a fresh one seconds later and again tomorrow — that is how
 * unlimited uses inside the window are delivered. Nothing here mutates: the
 * image route mints, and only a member of staff can redeem.
 *
 * Mirrors `components/customer/reward-collection-qr.tsx`.
 */
export function OfferPassQr({
  entitlementId,
  venueName,
  discountPercent,
}: {
  entitlementId: string
  venueName: string
  discountPercent: number
}) {
  // `tick` cache-busts the src on each scheduled refresh; bumping it on retry
  // also forces a fresh fetch after a failure.
  const [tick, setTick] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  // Consecutive image failures. An expired session at the counter makes the
  // route 404 forever, so repeated failures offer a sign-in path rather than an
  // unwinnable retry loop. A successful load resets the count.
  const [failCount, setFailCount] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setLoaded(false)
      setErrored(false)
      setTick((value) => value + 1)
    }, offerPassQrRefreshIntervalMs())

    return () => clearInterval(timer)
  }, [])

  function retry() {
    setLoaded(false)
    setErrored(false)
    setTick((value) => value + 1)
  }

  if (errored) {
    return (
      <PassQrRecovery
        entitlementId={entitlementId}
        suggestSignIn={failCount >= 2}
        onRetry={retry}
      />
    )
  }

  return (
    <div className="grid gap-3">
      {/* Capped so the helper banner and the fresh-code button stay above the
          fold at the counter; the code inside scales up crisply because the
          route renders it at full resolution. */}
      <QrFrame
        label={`Staff-scan QR for your ${discountPercent}% pass`}
        className="mx-auto w-full max-w-[16rem] sm:max-w-[18rem]"
      >
        <div className="relative aspect-square w-full">
          {loaded ? null : (
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse rounded-md bg-secondary motion-reduce:animate-none"
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pass QR, minted by a protected route on every request */}
          <img
            src={offerPassQrCacheBustedSrc(entitlementId, tick)}
            alt={`QR code for your ${discountPercent}% discount pass at ${venueName}`}
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
      <p className="rounded-lg bg-secondary px-3 py-2 text-center text-sm font-bold text-foreground">
        A team member scans this before they apply the discount
      </p>
      {/* Counter mode (02#33) — same refreshing source, full-bleed. */}
      <PresentCodeButton
        label="Show at the counter"
        title={`${discountPercent}% off at ${venueName}`}
        caption="Hold this up for the team to scan"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin pass QR from a protected route */}
        <img
          src={offerPassQrCacheBustedSrc(entitlementId, tick)}
          alt={`QR code for your ${discountPercent}% discount pass at ${venueName}`}
          className="aspect-square w-full object-contain"
        />
      </PresentCodeButton>
      {/* Each code is single-use and lasts ten minutes, but the pass itself has
          no limit. Without this control a customer using the pass twice in one
          visit would stare at a code that has already been collected until the
          scheduled refresh came round, so the promise that it "works as many
          times as you like" needs a button, not just a timer. */}
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="w-full"
        onClick={retry}
      >
        Show a fresh code
      </Button>
    </div>
  )
}

function PassQrRecovery({
  entitlementId,
  suggestSignIn,
  onRetry,
}: {
  entitlementId: string
  suggestSignIn: boolean
  onRetry: () => void
}) {
  return (
    <StatusBanner title="We could not show your pass code" tone="warning">
      <span className="grid gap-3">
        <span>Try again, or ask a team member to help.</span>
        {suggestSignIn ? (
          <span>
            Still nothing? You may be signed out on this phone —{" "}
            <Link
              href={customerLoginHref(`/pass/${entitlementId}`)}
              className="font-bold underline underline-offset-4"
            >
              sign in with your number
            </Link>{" "}
            to bring your pass back.
          </span>
        ) : null}
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={onRetry}
        >
          Show a fresh code
        </Button>
      </span>
    </StatusBanner>
  )
}
