"use client"

import Link from "next/link"
import { ArrowLeft02Icon, PrinterIcon } from "@hugeicons/core-free-icons"

import { recordNfcSquarePrintAction } from "@/app/app/qr/nfc-square/actions"
import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  getNfcSquareDesign,
  type NfcSquareDesignId,
} from "@/lib/qr/nfc-square-templates"

import styles from "./a4-nfc-square.module.css"
import { NfcSquareSheet } from "./nfc-square-sheet"

type A4NfcSquareProps = {
  readonly design: NfcSquareDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly locality?: string | null
  readonly stampsRequired: number
  readonly backHref?: string
}

export function A4NfcSquare({
  design,
  qrDataUrl,
  merchantName,
  locality,
  stampsRequired,
  backHref,
}: A4NfcSquareProps) {
  const meta = getNfcSquareDesign(design)

  return (
    <main
      className={`${styles.page} qr-poster-print-root`}
      data-sheet="nfc-square-100"
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
            void recordNfcSquarePrintAction(design)
            window.print()
          }}
        >
          <Icon icon={PrinterIcon} size={16} />
          Print or save PDF
        </Button>
      </header>
      <div className={styles.stage}>
        <div className={styles.sheetNative}>
          <NfcSquareSheet
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
