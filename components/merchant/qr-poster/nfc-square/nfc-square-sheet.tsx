import { resolveNfcSquareContent } from "@/lib/qr/nfc-square-content"
import type { NfcSquareDesignId } from "@/lib/qr/nfc-square-templates"

import { NfcSquareFront } from "./nfc-square-front"
import styles from "./nfc-square-sheet.module.css"

type NfcSquareSheetProps = {
  readonly design: NfcSquareDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
}

/**
 * Native 100×100 mm print page — the page size is the die. Print at 100%.
 */
export function NfcSquareSheet({
  design,
  qrDataUrl,
  merchantName,
  stampsRequired,
}: NfcSquareSheetProps) {
  const content = resolveNfcSquareContent(design, stampsRequired)
  const venue = merchantName.trim()
  const faceStyle = {
    width: `${content.geometry.cardWidthMm}mm`,
    height: `${content.geometry.cardHeightMm}mm`,
  }

  return (
    <div className={styles.deck} data-design={design}>
      <section
        className={styles.face}
        style={faceStyle}
        aria-label="Counter NFC plate"
      >
        <NfcSquareFront content={content} venue={venue} qrDataUrl={qrDataUrl} />
      </section>
    </div>
  )
}
