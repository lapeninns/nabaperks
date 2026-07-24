"use client"

import Link from "next/link"
import { ArrowLeft02Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { recordNfcCardPrintAction } from "@/app/app/qr/nfc/actions"
import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  getNfcCardDesign,
  type NfcCardDesignId,
} from "@/lib/qr/nfc-card-templates"

import styles from "./a4-nfc-card.module.css"
import { NfcCardSheet } from "./nfc-card-sheet"

type A4NfcCardProps = {
  readonly design: NfcCardDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly locality?: string | null
  readonly stampsRequired: number
  readonly backHref?: string
}

export function A4NfcCard({
  design,
  qrDataUrl,
  merchantName,
  locality,
  stampsRequired,
  backHref,
}: A4NfcCardProps) {
  const meta = getNfcCardDesign(design)

  return (
    <main
      className={`${styles.page} qr-poster-print-root`}
      data-sheet="cr80-nfc-card"
    >
      <header className={`${styles.chrome} qr-poster-chrome`}>
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
              <Link href={backHref}>
                <Icon icon={ArrowLeft02Icon} size={16} />
                Back
              </Link>
            </Button>
          ) : null}
          <div className={styles.chromeMeta}>
            <h1 className={styles.chromeTitle}>{meta?.name ?? design}</h1>
            <span className={styles.chromeVenue}>{merchantName}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="reward"
          className="min-h-11 sm:min-h-9"
          onClick={() => {
            void recordNfcCardPrintAction(design)
            window.print()
          }}
        >
          <Icon icon={PrinterIcon} size={16} />
          Print or save PDF
        </Button>
      </header>
      <div className={styles.stage}>
        <div className={styles.sheetNative}>
          <NfcCardSheet
            design={design}
            qrDataUrl={qrDataUrl}
            merchantName={merchantName}
            locality={locality}
            stampsRequired={stampsRequired}
          />
        </div>
      </div>
    </main>
  )
}
