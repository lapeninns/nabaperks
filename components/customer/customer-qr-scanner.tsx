"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { IconRoundel, ReceiptCard } from "@/components/brand"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"
import { scannerGuidance } from "@/lib/customer/scanner-guidance"
import { cn } from "@/lib/utils"
import { createQrCameraScanner } from "@/lib/qr/qr-camera-scanner"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error" }

const SCANNER_ELEMENT_ID = "nabaperks-customer-qr-scanner"
export function CustomerQrScanner() {
  const router = useRouter()
  const hasDecodedRef = useRef(false)
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })

  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    let disposed = false
    hasDecodedRef.current = false
    const mountTarget = document.getElementById(SCANNER_ELEMENT_ID)
    if (!mountTarget) return
    mountTarget.replaceChildren()
    const reportCameraError = () => {
      if (!disposed) setStatus({ kind: "camera-error" })
    }
    const scanner = createQrCameraScanner(
      mountTarget,
      (decodedText) => {
        if (hasDecodedRef.current || disposed) return
        const result = normalizeScannedQrDestination(
          decodedText,
          window.location.origin
        )
        if (result.kind === "invalid") {
          setStatus((previous) =>
            previous.kind === "invalid" ? previous : { kind: "invalid" }
          )
          return
        }
        hasDecodedRef.current = true
        setStatus({ kind: "decoded" })
        scanner.stop()
        router.push(result.href)
      },
      reportCameraError
    )

    async function startScanner() {
      try {
        await scanner.start()
        if (!disposed) setStatus({ kind: "scanning" })
      } catch {
        reportCameraError()
      }
    }

    void startScanner()

    return () => {
      disposed = true
      scanner.stop()
    }
  }, [router, retryNonce])

  const retryCamera = useCallback(() => {
    hasDecodedRef.current = false
    setStatus({ kind: "idle" })
    // Re-run the start effect (re-creates the scanner and restarts the camera)
    // without calling a setState-bearing callback synchronously from the effect.
    setRetryNonce((nonce) => nonce + 1)
  }, [])

  const statusText =
    status.kind === "idle"
      ? "Starting camera"
      : status.kind === "scanning"
        ? "Point at the QR on the counter"
        : status.kind === "decoded"
          ? "Found it. Opening your card"
          : status.kind === "invalid"
            ? "That's not a Nabaperks QR"
            : "We can't use your camera"

  const guidance = scannerGuidance(status.kind)

  // Camera-error is the one stuck moment: retrying is the single primary job,
  // so while the retry shows, the standing exits demote (start → ghost,
  // cards → secondary) and "Try the camera again" holds the only vermillion
  // slot (VCU-P1-01). Outside that state the original pair returns.
  const exitStartVariant = guidance.showRetry ? "ghost" : "secondary"
  const exitCardsVariant = guidance.showRetry ? "secondary" : undefined

  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <div className="grid gap-3">
        <IconRoundel icon={Camera01Icon} iconSize={22} tone="accent" />
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
            Scan the venue QR
          </h1>
          {/* Same barista line as the loader fallback — no system vocabulary
              (CUS-P2-11). */}
          <p className="text-sm leading-6 text-muted-foreground">
            Point your camera at the QR on the counter to open your card.
          </p>
        </div>
      </div>

      {/* The dead viewfinder collapses once the camera errors so the recovery
          actions sit high on small phones (VCU-P3-03). The element stays in
          the DOM (hidden) — retry resets status to idle first, so the box is
          visible again before the scanner restarts into it. */}
      <div
        className={cn(
          "aspect-square overflow-hidden rounded-[var(--radius)] border-2 border-dashed border-border bg-card",
          status.kind === "camera-error" && "hidden"
        )}
      >
        <div
          id={SCANNER_ELEMENT_ID}
          className="size-full [&_video]:size-full [&_video]:object-cover"
        />
      </div>

      <div
        aria-live="polite"
        className="text-sm leading-6 font-semibold text-foreground"
      >
        {statusText}
      </div>

      {guidance.detail ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {guidance.detail}
        </p>
      ) : null}

      {guidance.showRetry ? (
        <Button type="button" className="w-full" onClick={retryCamera}>
          Try the camera again
        </Button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant={exitStartVariant} className="w-full">
          <Link href="/start">Back to start</Link>
        </Button>
        <Button asChild variant={exitCardsVariant} className="w-full">
          <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
        </Button>
      </div>
    </ReceiptCard>
  )
}
