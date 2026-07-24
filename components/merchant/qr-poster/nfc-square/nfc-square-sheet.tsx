import { resolveNfcSquareContent } from "@/lib/qr/nfc-square-content"
import type { NfcSquareDesignId } from "@/lib/qr/nfc-square-templates"

import { GoogleReviewSquare } from "./google-review-square"
import { NfcSquareFront } from "./nfc-square-front"
import styles from "./nfc-square-sheet.module.css"

type NfcSquareSheetProps = {
  readonly design: NfcSquareDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly locality?: string | null
  readonly stampsRequired: number
}

/**
 * Native 100×100 mm print page — the page size is the die. Print at 100%.
 */
export function NfcSquareSheet({
  design,
  qrDataUrl,
  merchantName,
  locality,
  stampsRequired,
}: NfcSquareSheetProps) {
  const venue = merchantName.trim()
  const content = resolveNfcSquareContent(
    design,
    stampsRequired,
    locality?.trim() || venue
  )
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
        {design === "google-review" ? (
          <GoogleReviewSquare
            content={content}
            venue={venue}
            qrDataUrl={qrDataUrl}
          />
        ) : (
          <NfcSquareFront
            content={content}
            venue={venue}
            qrDataUrl={qrDataUrl}
          />
        )}
      </section>
    </div>
  )
}
