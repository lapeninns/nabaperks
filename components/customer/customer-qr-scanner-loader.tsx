"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import dynamic from "next/dynamic"
import Link from "next/link"

import { Eyebrow, Icon, IconRoundel, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"

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
      <div className="grid gap-3">
        <IconRoundel icon={Camera01Icon} iconSize={22} tone="accent" />
        <div className="grid gap-1.5">
          <Eyebrow>Customer scanner</Eyebrow>
          {/* Same headline as the loaded scanner (CUS-P3-11) — no string flip
              when the chunk lands. */}
          <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
            Scan venue QR
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Point your camera at a Nabaperks venue QR to collect your stamp. No
            app, no plastic.
          </p>
        </div>
      </div>

      <div className="grid aspect-square place-items-center overflow-hidden rounded-[var(--radius)] border-2 border-dashed border-border bg-card">
        <span className="grid justify-items-center gap-2 text-center">
          <Icon
            icon={Camera01Icon}
            size={28}
            className="text-muted-foreground motion-safe:animate-pulse motion-reduce:animate-none"
          />
          <span
            aria-live="polite"
            className="mono-id tracking-[0.08em] text-muted-foreground"
          >
            Starting camera
          </span>
        </span>
      </div>

      {/* Matches the loaded scanner: signed in, the tab bar is the navigation
          and the loader must not flash a pair of exits that the loaded state
          will not render (CUS 02#60). */}
      {hasAppNavigation ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="secondary" className="w-full">
            <Link href="/start">Back to start</Link>
          </Button>
          <Button asChild className="w-full">
            <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
          </Button>
        </div>
      )}
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
