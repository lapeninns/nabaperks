"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import dynamic from "next/dynamic"

import { Icon, ReceiptCard } from "@/components/brand"

import { ScannerExits, ScannerIntro } from "./scanner-chrome"

const loadScanner = () =>
  import("./customer-qr-scanner").then((module) => module.CustomerQrScanner)

/**
 * Two handles onto the *same* chunk. `dynamic`'s `loading` element is fixed at
 * module scope, so this is the only way the fallback can know whether the tab
 * bar is already on screen — and it has to know, or the exits it draws are the
 * pair the loaded scanner then removes, which is a visible jump at first paint
 * (CUS 02#60). Same import specifier, so webpack emits one chunk.
 */
const CustomerQrScannerStandalone = dynamic(loadScanner, {
  ssr: false,
  loading: () => <CustomerQrScannerLoading hasAppNavigation={false} />,
})

const CustomerQrScannerInAppShell = dynamic(loadScanner, {
  ssr: false,
  loading: () => <CustomerQrScannerLoading hasAppNavigation />,
})

function CustomerQrScannerLoading({
  hasAppNavigation,
}: {
  hasAppNavigation: boolean
}) {
  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      {/* Same header component AND the same sentence as the loaded scanner
          (CUS-P3-11, CUS 02#62) — no markup flip and no string flip when the
          chunk lands. The sentence is restated rather than imported because
          CUS-P2-11 pins it inside customer-qr-scanner.tsx and importing it from
          there would drag the deferred chunk into this fallback; CUS-P2-11 now
          also asserts the two statements are identical. */}
      <ScannerIntro description="Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic." />

      <div className="grid aspect-square place-items-center overflow-hidden rounded-[var(--radius)] border-2 border-dashed border-border bg-card">
        <span className="grid justify-items-center gap-2 text-center">
          <Icon
            icon={Camera01Icon}
            size={28}
            className="text-muted-foreground motion-safe:animate-pulse motion-reduce:animate-none"
          />
          <span
            aria-live="polite"
            className="mono-id tracking-tag text-muted-foreground"
          >
            Starting camera
          </span>
        </span>
      </div>

      {/* Matches the loaded scanner: signed in, the tab bar is the navigation
          and the loader must not flash a pair of exits that the loaded state
          will not render (CUS 02#60). "Matches" is now structural — one
          component draws both — rather than two hand-kept copies, which is how
          the grid drifted last time (CUS 02#62). */}
      {hasAppNavigation ? null : <ScannerExits />}
    </ReceiptCard>
  )
}

export function CustomerQrScannerLoader({
  hasAppNavigation = false,
}: {
  /** True when /scan renders inside CustomerAppShell — see CustomerQrScanner. */
  hasAppNavigation?: boolean
}) {
  const Scanner = hasAppNavigation
    ? CustomerQrScannerInAppShell
    : CustomerQrScannerStandalone

  return <Scanner hasAppNavigation={hasAppNavigation} />
}
