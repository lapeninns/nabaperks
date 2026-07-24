import type { NfcCardContent } from "@/lib/qr/nfc-card-content"

import { GoogleGMark, NfcTapMark, ReviewStars } from "../google-review-mark"
import styles from "./google-review-card.module.css"

type GoogleReviewCardProps = {
  readonly content: NfcCardContent
  readonly venue: string
  readonly qrDataUrl: string
}

function splitTrailingWords(value: string, count: number) {
  const words = value.trim().split(/\s+/)
  const splitAt = Math.max(1, words.length - count)
  return {
    lead: words.slice(0, splitAt).join(" "),
    accent: words.slice(splitAt).join(" "),
  }
}

export function GoogleReviewCardFront({
  content,
  venue,
}: GoogleReviewCardProps) {
  const { front } = content
  const headline = splitTrailingWords(front.brandName, 1)

  return (
    <article
      className={styles.card}
      data-nfc-face="front"
      aria-label={`${venue} Google Review NFC card front`}
    >
      <section className={styles.paperZone}>
        <p className={styles.eyebrow}>{front.brandEyebrow}</p>
        <h2>
          {headline.lead} <em>{headline.accent}</em>
        </h2>
        <p className={styles.lede}>{front.stampCue}</p>
        <span className={styles.googleBadge} aria-hidden="true">
          <GoogleGMark />
        </span>
      </section>

      <section className={styles.tapStage} aria-label="Tap to review">
        <ReviewStars className={styles.stars} />
        <p className={styles.tapButton}>
          <NfcTapMark />
          {front.tapWord}
        </p>
      </section>
    </article>
  )
}

export function GoogleReviewCardBack({
  content,
  venue,
  qrDataUrl,
}: GoogleReviewCardProps) {
  const { back } = content

  return (
    <article
      className={styles.card}
      data-nfc-face="back"
      aria-label={`${venue} Google Review NFC card back`}
    >
      <header className={styles.blueStrip}>
        <h2>{back.strap}</h2>
        <span className={styles.stripGoogle} aria-hidden="true">
          <GoogleGMark />
        </span>
      </header>

      <section className={styles.backPaper}>
        <div className={styles.backBody}>
          <ol className={styles.steps}>
            {back.steps.map((step, index) => (
              <li key={step.title}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
              </li>
            ))}
          </ol>

          <div className={styles.qrPanel}>
            <strong>No tap?</strong>
            <div className={styles.qrShell}>
              {/* eslint-disable-next-line @next/next/no-img-element -- print QR data URL */}
              <img src={qrDataUrl} alt="Google review QR code" />
            </div>
            <span>Scan to review</span>
          </div>
        </div>

        <footer className={styles.backMeta}>
          <strong>{venue}</strong>
          <span>{back.footBrand}</span>
        </footer>
      </section>
    </article>
  )
}
