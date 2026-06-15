"use client"

import { Camera01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import dynamic from "next/dynamic"
import Link from "next/link"

import { Eyebrow, ReceiptCard } from "@/components/brand"
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

      <div className="border-stamp-300 min-h-72 overflow-hidden rounded-2xl border border-dashed bg-white" />

      <div aria-live="polite" className="text-ink-800 text-sm font-semibold">
        Starting camera...
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
