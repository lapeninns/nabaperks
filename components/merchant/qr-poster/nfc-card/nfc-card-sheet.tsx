import { resolveNfcCardContent } from "@/lib/qr/nfc-card-content"
import type { NfcCardDesignId } from "@/lib/qr/nfc-card-templates"

import {
  GoogleReviewCardBack,
  GoogleReviewCardFront,
} from "./google-review-card"
import { NfcCardBack } from "./nfc-card-back"
import { NfcCardFront } from "./nfc-card-front"
import styles from "./nfc-card-sheet.module.css"

type NfcCardSheetProps = {
  readonly design: NfcCardDesignId
  readonly qrDataUrl: string
  readonly merchantName: string
  readonly locality?: string | null
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
  locality,
  stampsRequired,
}: NfcCardSheetProps) {
  const venue = merchantName.trim()
  const content = resolveNfcCardContent(
    design,
    stampsRequired,
    locality?.trim() || venue
  )
  const faceStyle = {
    width: `${content.geometry.cardWidthMm}mm`,
    height: `${content.geometry.cardHeightMm}mm`,
  }
  const isGoogleReview = design === "google-review"

  return (
    <div className={styles.deck} data-design={design}>
      <section
        className={styles.face}
        style={faceStyle}
        aria-label="NFC card front"
      >
        {isGoogleReview ? (
          <GoogleReviewCardFront
            content={content}
            venue={venue}
            qrDataUrl={qrDataUrl}
          />
        ) : (
          <NfcCardFront content={content} venue={venue} qrDataUrl={qrDataUrl} />
        )}
      </section>
      <section
        className={styles.face}
        style={faceStyle}
        aria-label="NFC card back"
      >
        {isGoogleReview ? (
          <GoogleReviewCardBack
            content={content}
            venue={venue}
            qrDataUrl={qrDataUrl}
          />
        ) : (
          <NfcCardBack content={content} venue={venue} />
        )}
      </section>
    </div>
  )
}
