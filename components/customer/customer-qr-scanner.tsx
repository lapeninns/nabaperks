"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Eyebrow, IconRoundel, ReceiptCard } from "@/components/brand"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"
import { scannerGuidance } from "@/lib/customer/scanner-guidance"
import { cn } from "@/lib/utils"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error" }

const SCANNER_ELEMENT_ID = "nabaperks-customer-qr-scanner"
const SCAN_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1,
  disableFlip: false,
}

function canStopScanner(state: Html5QrcodeScannerState): boolean {
  return (
    state === Html5QrcodeScannerState.SCANNING ||
    state === Html5QrcodeScannerState.PAUSED
  )
}

function handleScannerError(error: unknown): void {
  if (error instanceof Error || typeof error === "string") {
    return
  }

  throw error
}

async function stopAndClearScanner(scanner: Html5Qrcode): Promise<void> {
  if (canStopScanner(scanner.getState())) {
    await scanner.stop()
  }

  scanner.clear()
}

export function CustomerQrScanner() {
  const router = useRouter()
  const hasDecodedRef = useRef(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isMountedRef = useRef(true)
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })

  const [retryNonce, setRetryNonce] = useState(0)

  // The camera starts on mount and re-starts whenever retryNonce changes. Keeping
  // startScanner *inside* the effect (rather than a shared useCallback) means its
  // state updates live in a locally-defined async function and all run after
  // `await scanner.start(...)` — never synchronously in the effect body — so there
  // is no cascading render for the linter to guard against.
  useEffect(() => {
    isMountedRef.current = true
    hasDecodedRef.current = false
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    })
    scannerRef.current = scanner

    async function navigateAfterScan(result: { readonly href: string }) {
      try {
        await stopAndClearScanner(scanner)
      } catch (error) {
        handleScannerError(error)
      }

      router.push(result.href)
    }

    async function startScanner() {
      try {
        await scanner.start(
          { facingMode: "environment" },
          SCAN_CONFIG,
          (decodedText) => {
            if (hasDecodedRef.current) {
              return
            }

            const result = normalizeScannedQrDestination(
              decodedText,
              window.location.origin
            )

            if (result.kind === "invalid") {
              if (isMountedRef.current) {
                setStatus({ kind: "invalid" })
              }

              return
            }

            hasDecodedRef.current = true

            if (isMountedRef.current) {
              setStatus({ kind: "decoded" })
            }

            void navigateAfterScan(result)
          },
          undefined
        )

        if (isMountedRef.current) {
          setStatus({ kind: "scanning" })
        }
      } catch (error) {
        if (error instanceof Error || typeof error === "string") {
          if (isMountedRef.current) {
            setStatus({ kind: "camera-error" })
          }

          return
        }

        throw error
      }
    }

    void startScanner()

    return () => {
      isMountedRef.current = false
      scannerRef.current = null
      void stopAndClearScanner(scanner).catch(handleScannerError)
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
      ? "Starting camera…"
      : status.kind === "scanning"
        ? "Scanning for a Nabaperks QR…"
        : status.kind === "decoded"
          ? "QR found. Opening your venue card…"
          : status.kind === "invalid"
            ? "That is not a Nabaperks QR. Point your camera at the venue QR to collect a stamp."
            : "Camera unavailable"

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
          <Eyebrow>Customer scanner</Eyebrow>
          <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
            Scan venue QR
          </h1>
          {/* Same barista line as the loader fallback — no system vocabulary
              (CUS-P2-11). */}
          <p className="text-sm leading-6 text-muted-foreground">
            Point your camera at a Nabaperks venue QR to collect your stamp. No
            app, no plastic.
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
