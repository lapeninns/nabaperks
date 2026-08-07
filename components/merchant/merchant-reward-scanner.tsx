"use client"

import { FlashlightIcon, FlashlightOffIcon } from "@hugeicons/core-free-icons"
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Icon, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"

type CameraErrorReason = "denied" | "not-found" | "busy" | "unavailable"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error"; readonly reason: CameraErrorReason }

const SCANNER_ELEMENT_ID = "nabaperks-merchant-reward-scanner"

/**
 * Decode region as a share of the viewfinder's short edge, drawn at exactly the
 * same share by {@link ScanReticle} below, so the frame the merchant aims
 * inside IS the region the decoder reads. Mirrors the customer scanner, which
 * settled this geometry (CUS 02#59).
 */
const QRBOX_RATIO = 0.75

const SCAN_CONFIG = {
  fps: 10,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const edge = Math.floor(
      Math.min(viewfinderWidth, viewfinderHeight) * QRBOX_RATIO
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
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })
  const [retryCount, setRetryCount] = useState(0)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

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
        // Only mount the torch control where the running track actually
        // advertises it — a lamp button that does nothing is worse than none.
        setTorchSupported(
          scanner
            .getRunningTrackCameraCapabilities()
            .torchFeature()
            .isSupported()
        )
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
      scannerRef.current = null
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
    setTorchSupported(false)
    setTorchOn(false)
    // Bump retryCount so the camera-lifecycle effect re-runs and re-creates the
    // scanner, without calling a setState-bearing callback synchronously from
    // the effect body.
    setRetryCount((count) => count + 1)
  }, [])

  const toggleTorch = useCallback(() => {
    const scanner = scannerRef.current
    if (!scanner) return

    const next = !torchOn
    void scanner
      .getRunningTrackCameraCapabilities()
      .torchFeature()
      .apply(next)
      .then(() => {
        setTorchOn(next)
      })
      .catch(() => {
        // A camera that refuses the constraint loses the control rather than
        // keeping a button that lies about the lamp.
        setTorchSupported(false)
      })
  }, [torchOn])

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
      {/* role="group", not role="img": a live video region announced as a
          static image reads wrong to screen readers — a labelled plain region
          is enough, and the aria-live status line below narrates state. */}
      <div
        role="group"
        aria-label="Camera viewfinder"
        className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border-2 border-dashed border-ink/35 bg-card"
      >
        <div
          id={SCANNER_ELEMENT_ID}
          className="size-full [&_video]:size-full [&_video]:object-cover"
        />
        <ScanReticle />
        {torchSupported ? (
          <Button
            type="button"
            size="icon-lg"
            variant={torchOn ? "default" : "secondary"}
            aria-pressed={torchOn}
            onClick={toggleTorch}
            className="absolute right-3 bottom-3"
          >
            <Icon
              icon={torchOn ? FlashlightIcon : FlashlightOffIcon}
              size={20}
            />
            <span className="sr-only">
              {torchOn ? "Turn the torch off" : "Turn the torch on"}
            </span>
          </Button>
        ) : null}
      </div>

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

/**
 * Four corner marks at exactly {@link QRBOX_RATIO}, so the frame staff aim
 * inside is the region the decoder reads. The viewfinder was previously a plain
 * dashed box with nothing to aim at (03#64).
 */
function ScanReticle() {
  const inset = `${((1 - QRBOX_RATIO) / 2) * 100}%`

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ top: inset, right: inset, bottom: inset, left: inset }}
    >
      <span className="absolute top-0 left-0 size-6 border-t-2 border-l-2 border-ink" />
      <span className="absolute top-0 right-0 size-6 border-t-2 border-r-2 border-ink" />
      <span className="absolute bottom-0 left-0 size-6 border-b-2 border-l-2 border-ink" />
      <span className="absolute right-0 bottom-0 size-6 border-r-2 border-b-2 border-ink" />
    </span>
  )
}
