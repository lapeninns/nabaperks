"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Eyebrow, ReceiptCard } from "@/components/brand"
import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"

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
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })

  useEffect(() => {
    let isMounted = true
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
            if (hasDecodedRef.current) {
              return
            }

            const result = normalizeScannedQrDestination(
              decodedText,
              window.location.origin
            )

            if (result.kind === "invalid") {
              if (isMounted) {
                setStatus({ kind: "invalid" })
              }

              return
            }

            hasDecodedRef.current = true

            if (isMounted) {
              setStatus({ kind: "decoded" })
            }

            void navigateAfterScan(result)
          },
          undefined
        )

        if (isMounted) {
          setStatus({ kind: "scanning" })
        }
      } catch (error) {
        if (error instanceof Error || typeof error === "string") {
          if (isMounted) {
            setStatus({ kind: "camera-error" })
          }

          return
        }

        throw error
      }
    }

    void startScanner()

    return () => {
      isMounted = false
      void stopAndClearScanner(scanner).catch(handleScannerError)
    }
  }, [router])

  const statusText =
    status.kind === "idle"
      ? "Starting camera..."
      : status.kind === "scanning"
        ? "Scanning for a Nabaperks QR..."
        : status.kind === "decoded"
          ? "QR found. Opening your venue card..."
          : status.kind === "invalid"
            ? "That is not a Nabaperks QR"
            : "Camera unavailable"

  return (
    <ReceiptCard className="border-stamp-200 bg-cream-50 grid gap-5 p-5">
      <div className="grid gap-3">
        <span className="bg-stamp-100 text-stamp-700 flex h-11 w-11 items-center justify-center rounded-full">
          <HugeiconsIcon icon={Camera01Icon} size={24} aria-hidden />
        </span>
        <div className="space-y-2">
          <Eyebrow>Customer scanner</Eyebrow>
          <h1 className="text-ink-900 font-serif text-3xl leading-tight">
            Scan venue QR
          </h1>
          <p className="text-ink-600 text-sm leading-6">
            Point your camera at a Nabaperks venue QR. We will open the existing
            QR flow so your stamps, OTP checks, and rewards stay protected.
          </p>
        </div>
      </div>

      <div
        id={SCANNER_ELEMENT_ID}
        className="border-stamp-300 min-h-72 overflow-hidden rounded-2xl border border-dashed bg-white [&_video]:min-h-72 [&_video]:object-cover"
      />

      <div aria-live="polite" className="text-ink-800 text-sm font-semibold">
        {statusText}
      </div>

      {status.kind === "camera-error" ? (
        <p className="text-ink-600 text-sm leading-6">
          Allow camera access in your browser and use HTTPS or localhost, then
          reload this page to scan.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="secondary" className="w-full">
          <Link href="/start">Back to start</Link>
        </Button>
        <Button asChild className="w-full">
          <Link href="/home">Open my cards</Link>
        </Button>
      </div>
    </ReceiptCard>
  )
}
