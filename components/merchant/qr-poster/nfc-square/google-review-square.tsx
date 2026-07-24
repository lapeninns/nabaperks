import type { NfcSquareContent } from "@/lib/qr/nfc-square-content"

import { GoogleGMark, NfcTapMark, ReviewStars } from "../google-review-mark"
import styles from "./google-review-square.module.css"

type GoogleReviewSquareProps = {
  readonly content: NfcSquareContent
  readonly venue: string
  readonly qrDataUrl: string
}

export function GoogleReviewSquare({
  content,
  venue,
  qrDataUrl,
}: GoogleReviewSquareProps) {
  const { front } = content

  return (
    <article
      className={styles.plate}
      data-nfc-face="square-front"
      aria-label={`${venue} Google Review NFC plate`}
    >
      <section className={styles.paperZone}>
        <p className={styles.eyebrow}>{front.brandEyebrow}</p>
        <h2>
          Drop a Quick <em>Google Review.</em>
        </h2>
        <p className={styles.lede}>{front.claimLine}</p>
        <span className={styles.googleBadge} aria-hidden="true">
          <GoogleGMark />
        </span>
      </section>

      <section className={styles.tapStage} aria-label="Tap or scan to review">
        <div className={styles.stageAction}>
          <ReviewStars className={styles.stars} />
          <p className={styles.tapButton}>
            <NfcTapMark />
            {front.tapWord}
          </p>
        </div>

        <div className={styles.fallback}>
          <span>{front.tapSub}</span>
          <div className={styles.qrShell}>
            {/* eslint-disable-next-line @next/next/no-img-element -- print QR data URL */}
            <img src={qrDataUrl} alt="Google review QR code" />
          </div>
        </div>
      </section>
    </article>
  )
}
