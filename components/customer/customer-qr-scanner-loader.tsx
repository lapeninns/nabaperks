"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import dynamic from "next/dynamic"
import Link from "next/link"

import { Eyebrow, Icon, ReceiptCard } from "@/components/brand"
import { Button } from "@/components/ui/button"

const CustomerQrScanner = dynamic(
  () =>
    import("./customer-qr-scanner").then((module) => module.CustomerQrScanner),
  {
    ssr: false,
    loading: () => <CustomerQrScannerLoading />,
  }
)

function CustomerQrScannerLoading() {
  return (
    <ReceiptCard edge className="grid gap-5 p-6">
      <div className="grid gap-3">
        <span className="grid size-11 place-items-center rounded-full border-2 border-ink bg-accent text-accent-foreground">
          <Icon icon={Camera01Icon} size={22} />
        </span>
        <div className="grid gap-1.5">
          <Eyebrow>Customer scanner</Eyebrow>
          <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.01em]">
            Scan a venue QR
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
            className="font-mono text-[0.65rem] font-bold tracking-[0.08em] text-muted-foreground uppercase"
          >
            Starting camera
          </span>
        </span>
      </div>

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

export function CustomerQrScannerLoader() {
  return <CustomerQrScanner />
}
