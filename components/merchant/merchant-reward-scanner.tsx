"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"
import { createQrCameraScanner } from "@/lib/qr/qr-camera-scanner"
import { ScanCardHeader } from "./scan-card-header"

type CameraErrorReason = "denied" | "not-found" | "busy" | "unavailable"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error"; readonly reason: CameraErrorReason }

const SCANNER_ELEMENT_ID = "nabaperks-merchant-reward-scanner"
function cameraErrorReason(error: unknown): CameraErrorReason {
  const name =
    error instanceof Error ? error.name : typeof error === "string" ? error : ""

  if (/NotAllowedError|SecurityError|PermissionDenied/i.test(name)) {
    return "denied"
  }

  if (/NotFoundError|DevicesNotFound|OverconstrainedError/i.test(name)) {
    return "not-found"
  }

  if (/NotReadableError|TrackStartError|AbortError/i.test(name)) {
    return "busy"
  }

  return "unavailable"
}

const CAMERA_ERROR_STATUS: Record<CameraErrorReason, string> = {
  denied: "Camera access blocked",
  "not-found": "No camera found",
  busy: "Camera is busy",
  unavailable: "Camera unavailable",
}

const CAMERA_ERROR_DETAIL: Record<CameraErrorReason, string> = {
  denied:
    "Allow camera access in your browser, make sure you are on HTTPS or localhost, then try again.",
  "not-found":
    "We could not find a camera on this device. Connect a camera, then try again.",
  busy: "Another app or tab is using the camera. Close it, then try again.",
  unavailable:
    "Allow camera access in your browser and use HTTPS or localhost, then try again.",
}

export function MerchantRewardScanner() {
  const router = useRouter()
  const hasDecodedRef = useRef(false)
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let disposed = false
    hasDecodedRef.current = false
    const mountTarget = document.getElementById(SCANNER_ELEMENT_ID)
    if (!mountTarget) return
    mountTarget.replaceChildren()
    const reportCameraError = (error: unknown) => {
      if (!disposed) {
        setStatus({ kind: "camera-error", reason: cameraErrorReason(error) })
      }
    }
    const scanner = createQrCameraScanner(
      mountTarget,
      (decodedText) => {
        if (hasDecodedRef.current || disposed) return
        const result = normalizeScannedRewardDestination(
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
      } catch (error) {
        reportCameraError(error)
      }
    }

    void startScanner()

    return () => {
      disposed = true
      scanner.stop()
    }
  }, [router, retryCount])

  const retryCamera = useCallback(() => {
    hasDecodedRef.current = false
    setStatus({ kind: "idle" })
    // Bump retryCount so the camera-lifecycle effect re-runs and re-creates the
    // scanner, without calling a setState-bearing callback synchronously from
    // the effect body.
    setRetryCount((count) => count + 1)
  }, [])

  const statusText =
    status.kind === "idle"
      ? "Starting camera…"
      : status.kind === "scanning"
        ? "Scanning for a customer code…"
        : status.kind === "decoded"
          ? "Customer code found. Opening it…"
          : status.kind === "invalid"
            ? "That is not a reward or discount pass code from a customer"
            : CAMERA_ERROR_STATUS[status.reason]

  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <ScanCardHeader />

      {/* role="group", not role="img": a live video region announced as a
          static image reads wrong to screen readers — a labelled plain region
          is enough, and the aria-live status line below narrates state. */}
      <div
        id={SCANNER_ELEMENT_ID}
        role="group"
        aria-label="Camera viewfinder"
        className="min-h-64 overflow-hidden rounded-[var(--radius-lg)] border-2 border-dashed border-ink/35 bg-card [&_video]:min-h-64 [&_video]:object-cover"
      />

      <div aria-live="polite" className="grid gap-1.5">
        <p className="text-sm font-bold">{statusText}</p>
        {status.kind === "camera-error" ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {CAMERA_ERROR_DETAIL[status.reason]}
          </p>
        ) : null}
      </div>

      {status.kind === "camera-error" ? (
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={retryCamera}
        >
          Try again
        </Button>
      ) : null}

      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </ReceiptCard>
  )
}
