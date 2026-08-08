"use client"

import {
  Camera01Icon,
  FlashlightIcon,
  FlashlightOffIcon,
} from "@hugeicons/core-free-icons"
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Eyebrow, Icon, IconRoundel, ReceiptCard } from "@/components/brand"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"
import { scannerGuidance } from "@/lib/customer/scanner-guidance"
import { cn } from "@/lib/utils"

type ScannerStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "scanning" }
  | { readonly kind: "struggling" }
  | { readonly kind: "decoded" }
  | { readonly kind: "invalid" }
  | { readonly kind: "camera-error" }

const SCANNER_ELEMENT_ID = "nabaperks-customer-qr-scanner"

/**
 * The decode region is derived from the viewfinder rather than pinned at
 * 250x250. The viewfinder is the receipt inner measure — 247px at a 320px
 * viewport, 314px on a Pro Max — so a fixed box was *larger* than the visible
 * video on a small phone (aim at a region you cannot see) and a fifth smaller
 * than it on a large one (CUS 02#59). 75% of the short edge, drawn at exactly
 * the same 75% by the reticle below, so the visible frame IS the decode region.
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

/** How long a live camera may find nothing before we offer help (CUS 02#58). */
const STRUGGLING_AFTER_MS = 12_000

/** How long the viewfinder flashes red after a wrong code (CUS 02#61). */
const INVALID_FLASH_MS = 600

/** Ignore repeat decodes of the same wrong code inside this window. */
const INVALID_DEBOUNCE_MS = 1_500

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

/**
 * Haptics are best-effort: iOS Safari has no Vibration API and desktop has no
 * motor. Feedback at the counter should never depend on it, so every call site
 * treats it as an extra, and a throwing implementation is swallowed.
 */
function vibrate(pattern: number | readonly number[]): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return

  try {
    navigator.vibrate(pattern as number | number[])
  } catch {
    // A device that refuses to buzz is not an error worth surfacing.
  }
}

export function CustomerQrScanner({
  hasAppNavigation = false,
}: {
  /**
   * True when `/scan` is rendered inside `CustomerAppShell`, i.e. the member is
   * signed in and the fixed tab bar is already on screen. The scanner then
   * renders no exits of its own rather than stacking a second navigation system
   * (and a link out to the marketing switchboard) under the viewfinder
   * (CUS 02#60).
   */
  hasAppNavigation?: boolean
}) {
  const router = useRouter()
  const hasDecodedRef = useRef(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isMountedRef = useRef(true)
  const [status, setStatus] = useState<ScannerStatus>({ kind: "idle" })
  const [invalidFlash, setInvalidFlash] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const [retryNonce, setRetryNonce] = useState(0)

  // The camera starts on mount and re-starts whenever retryNonce changes. Keeping
  // startScanner *inside* the effect (rather than a shared useCallback) means its
  // state updates live in a locally-defined async function and all run after
  // `await scanner.start(...)` — never synchronously in the effect body — so there
  // is no cascading render for the linter to guard against.
  useEffect(() => {
    isMountedRef.current = true
    hasDecodedRef.current = false
    let lastInvalidAt = 0
    let flashTimer: number | null = null
    let struggleTimer: number | null = null
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

    // A wrong code used to change three words under the video and keep
    // scanning, which nobody notices at arm's length in a pub. It now flashes
    // the frame and buzzes, debounced so re-decoding the same wrong code does
    // not strobe (CUS 02#61).
    function reportInvalid() {
      const now = Date.now()
      if (now - lastInvalidAt < INVALID_DEBOUNCE_MS) return
      lastInvalidAt = now

      if (!isMountedRef.current) return

      setStatus({ kind: "invalid" })
      setInvalidFlash(true)
      vibrate([12, 60, 12])

      if (flashTimer !== null) window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => {
        flashTimer = null
        if (isMountedRef.current) setInvalidFlash(false)
      }, INVALID_FLASH_MS)
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
              reportInvalid()

              return
            }

            hasDecodedRef.current = true
            if (struggleTimer !== null) window.clearTimeout(struggleTimer)
            // The one unambiguous "it worked" signal that survives a noisy
            // room and a phone held at arm's length.
            vibrate(24)

            if (isMountedRef.current) {
              setStatus({ kind: "decoded" })
            }

            void navigateAfterScan(result)
          },
          undefined
        )

        if (isMountedRef.current) {
          setStatus({ kind: "scanning" })
          setTorchSupported(
            scanner
              .getRunningTrackCameraCapabilities()
              .torchFeature()
              .isSupported()
          )
        }

        // A live camera that has found nothing after twelve seconds is not
        // "scanning", it is stuck — usually on pub lighting. Say so, and offer
        // the torch and the printed-code path instead of an unchanging line.
        struggleTimer = window.setTimeout(() => {
          struggleTimer = null
          if (!isMountedRef.current || hasDecodedRef.current) return
          setStatus((current) =>
            current.kind === "scanning" ? { kind: "struggling" } : current
          )
        }, STRUGGLING_AFTER_MS)
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
      if (flashTimer !== null) window.clearTimeout(flashTimer)
      if (struggleTimer !== null) window.clearTimeout(struggleTimer)
      void stopAndClearScanner(scanner).catch(handleScannerError)
    }
  }, [router, retryNonce])

  const retryCamera = useCallback(() => {
    hasDecodedRef.current = false
    setStatus({ kind: "idle" })
    setTorchSupported(false)
    setTorchOn(false)
    // Re-run the start effect (re-creates the scanner and restarts the camera)
    // without calling a setState-bearing callback synchronously from the effect.
    setRetryNonce((nonce) => nonce + 1)
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
        // A camera that refuses the constraint keeps its current state rather
        // than showing a control that lies about the lamp.
        setTorchSupported(false)
      })
  }, [torchOn])

  const statusText =
    status.kind === "idle"
      ? "Starting camera…"
      : status.kind === "scanning"
        ? "Scanning for a Nabaperks QR…"
        : status.kind === "struggling"
          ? "Still looking for a Nabaperks QR…"
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
          "relative aspect-square overflow-hidden rounded-lg border-2 border-dashed bg-card transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
          invalidFlash ? "border-destructive" : "border-border",
          status.kind === "camera-error" && "hidden"
        )}
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

      {/* Signed in, the fixed tab bar is already the navigation: a second exit
          pair under the viewfinder was ~100px of duplicate chrome, and one of
          the two sent the member out to the marketing switchboard (CUS 02#60). */}
      {hasAppNavigation ? null : (
        // No `sm:grid-cols-2`: the customer column is capped at 410px, so the
        // split fired on VIEWPORT width the container never sees. Measured at
        // an 800px viewport it produced two 173px buttons inside a 358px row —
        // narrower targets on a bigger screen, for a pair of full sentences
        // ("Back to start", "Open my cards"). Stacked full-width at every size,
        // which is what the phone already got (CUS 02#6).
        <div className="grid gap-3">
          <Button asChild variant={exitStartVariant} className="w-full">
            <Link href="/start">Back to start</Link>
          </Button>
          <Button asChild variant={exitCardsVariant} className="w-full">
            <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
          </Button>
        </div>
      )}
    </ReceiptCard>
  )
}

/**
 * Four corner marks at exactly {@link QRBOX_RATIO}, so the frame the member
 * aims inside is the region the decoder reads. The viewfinder used to be a
 * plain dashed square with nothing to aim at (CUS 02#58).
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
