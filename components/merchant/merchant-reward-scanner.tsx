"use client"

import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Eyebrow, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"

// Single source for the scan-card header. The live scanner, the dynamic-import
// fallback, and the route-level loading skeleton all render this so the
// eyebrow/title/lede/size stay in lockstep with one copy edit, and the title
// matches the PageTitle size used by the reward-scan deep-link page
// (text-3xl sm:text-4xl) rather than the old bespoke text-2xl heading.
export function ScanCardHeader() {
  return (
    <div className="grid gap-1.5">
      <Eyebrow>Reward collection</Eyebrow>
      <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.01em] sm:text-4xl">
        Scan reward QR
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Point your camera at the QR on the member&apos;s phone. We will open the
        collection screen when it is ready to mark collected.
      </p>
    </div>
  )
}

type CameraErrorReason = "denied" | "not-found" | "busy" | "unavailable"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error"; readonly reason: CameraErrorReason }

const SCANNER_ELEMENT_ID = "nabaperks-merchant-reward-scanner"
const SCAN_CONFIG = {
  fps: 10,
  // Viewport-relative shaded box: scale to 80% of the smaller camera edge so it
  // never crowds the ~272px inner width of the p-6 ReceiptCard on a 320px phone,
  // while still capping at 250px on larger screens. >=180px keeps the box usable
  // on the smallest target. UI/config only — no scan semantics change.
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const edge = Math.max(
      180,
      Math.min(250, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8))
    )
    return { width: edge, height: edge }
  },
  aspectRatio: 1,
  disableFlip: false,
}

// html5-qrcode rejects `start()` with a DOMException (or, on some browsers, its
// string message) describing why the camera could not open. Map the well-known
// getUserMedia error names to a specific reason so the announced status and the
// remediation copy can name the actual failure instead of "Camera unavailable".
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

// Synchronously release the camera hardware by stopping every track on the
// injected <video>'s MediaStream. `scanner.stop()` is async and may not finish
// before navigation tears the component down, so this is the immediate fallback
// that turns the camera light off the moment cleanup runs.
function stopVideoTracks(): void {
  const mountTarget = document.getElementById(SCANNER_ELEMENT_ID)
  const video = mountTarget?.querySelector("video")
  const stream = video?.srcObject

  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop()
    }
  }
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
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let disposed = false
    hasDecodedRef.current = false
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
                // Latch the invalid state so a fresh object isn't created on
                // every decode tick (~10fps) while the camera keeps reading the
                // same non-reward QR.
                setStatus((prev) =>
                  prev.kind === "invalid" ? prev : { kind: "invalid" }
                )
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
          setStatus({
            kind: "camera-error",
            reason: cameraErrorReason(error),
          })
          return
        }

        throw error
      }
    }

    void startScanner()

    return () => {
      disposed = true
      // Release the camera hardware synchronously first — `stopAndClearScanner`
      // is async and may not settle before navigation unmounts us, leaving the
      // MediaStream (and the camera light) alive.
      stopVideoTracks()
      void stopAndClearScanner(scanner).catch(handleScannerError)
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
      ? "Starting camera..."
      : status.kind === "scanning"
        ? "Scanning for a reward QR..."
        : status.kind === "decoded"
          ? "Reward QR found. Opening collection..."
          : status.kind === "invalid"
            ? "That is not a reward QR from a member card"
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
        <Button type="button" className="w-full sm:w-auto" onClick={retryCamera}>
          Try again
        </Button>
      ) : null}

      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/app">Back to dashboard</Link>
      </Button>
    </ReceiptCard>
  )
}
