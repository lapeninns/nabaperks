import { resolveNfcCardContent } from "@/lib/qr/nfc-card-content"
import type { NfcCardDesignId } from "@/lib/qr/nfc-card-templates"

import { NfcCardBack } from "./nfc-card-back"
import { NfcCardFront } from "./nfc-card-front"
import styles from "./nfc-card-sheet.module.css"

type NfcCardSheetProps = {
  readonly design: NfcCardDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly stampsRequired: number
}

/**
 * Native CR80 print deck: front page then back page, each 85.5 × 54 mm.
 * Print at 100% — page size is the die.
 */
export function NfcCardSheet({
  design,
  qrDataUrl,
  merchantName,
  stampsRequired,
}: NfcCardSheetProps) {
  const content = resolveNfcCardContent(design, stampsRequired)
  const venue = merchantName.trim()
  const faceStyle = {
    width: `${content.geometry.cardWidthMm}mm`,
    height: `${content.geometry.cardHeightMm}mm`,
  }

  return (
    <div className={styles.deck} data-design={design}>
      <p className={styles.screenHint} aria-hidden="true">
        {content.cutLabel}
      </p>
      <section
        className={styles.face}
        style={faceStyle}
        aria-label="NFC card front"
      >
        <NfcCardFront content={content} venue={venue} qrDataUrl={qrDataUrl} />
      </section>
      <section
        className={styles.face}
        style={faceStyle}
        aria-label="NFC card back"
      >
        <NfcCardBack content={content} venue={venue} />
      </section>
    </div>
  )
}
