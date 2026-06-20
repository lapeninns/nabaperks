"use client"

import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Eyebrow, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error" }

const SCANNER_ELEMENT_ID = "nabaperks-merchant-reward-scanner"
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

export function MerchantRewardScanner() {
  const router = useRouter()
  const hasDecodedRef = useRef(false)
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })

  useEffect(() => {
    let disposed = false
    const mountTarget = document.getElementById(SCANNER_ELEMENT_ID)
    if (mountTarget) {
      mountTarget.replaceChildren()
    }

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    })

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
            if (hasDecodedRef.current || disposed) {
              return
            }

            const result = normalizeScannedRewardDestination(
              decodedText,
              window.location.origin
            )

            if (result.kind === "invalid") {
              if (!disposed) {
                setStatus({ kind: "invalid" })
              }

              return
            }

            hasDecodedRef.current = true

            if (!disposed) {
              setStatus({ kind: "decoded" })
            }

            void navigateAfterScan(result)
          },
          undefined
        )

        if (disposed) {
          await stopAndClearScanner(scanner)
          return
        }

        setStatus({ kind: "scanning" })
      } catch (error) {
        if (disposed) {
          return
        }

        if (error instanceof Error || typeof error === "string") {
          setStatus({ kind: "camera-error" })
          return
        }

        throw error
      }
    }

    void startScanner()

    return () => {
      disposed = true
      void stopAndClearScanner(scanner).catch(handleScannerError)
    }
  }, [router])

  const statusText =
    status.kind === "idle"
      ? "Starting camera..."
      : status.kind === "scanning"
        ? "Scanning for a reward QR..."
        : status.kind === "decoded"
          ? "Reward QR found. Opening collection..."
          : status.kind === "invalid"
            ? "That is not a reward QR from a customer card"
            : "Camera unavailable"

  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <div className="grid gap-1.5">
        <Eyebrow>Reward collection</Eyebrow>
        <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
          Scan reward QR
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Point your camera at the QR on the customer&apos;s phone. We will open
          the collection screen when it is ready to mark collected.
        </p>
      </div>

      <div
        id={SCANNER_ELEMENT_ID}
        className="min-h-64 overflow-hidden rounded-[var(--radius-lg)] border-2 border-dashed border-ink/35 bg-card [&_video]:min-h-64 [&_video]:object-cover"
      />

      <div aria-live="polite" className="text-sm font-bold">
        {statusText}
      </div>

      {status.kind === "camera-error" ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Allow camera access in your browser and use HTTPS or localhost, then
          reload this page to scan.
        </p>
      ) : null}

      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app">Back to home</Link>
      </Button>
    </ReceiptCard>
  )
}
