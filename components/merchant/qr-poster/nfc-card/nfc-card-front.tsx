import type { NfcCardContent } from "@/lib/qr/nfc-card-content"

import styles from "./nfc-card-front.module.css"

type NfcCardFrontProps = {
  readonly content: NfcCardContent
  readonly venue: string
  readonly qrDataUrl: string
}

export function NfcCardFront({ content, venue, qrDataUrl }: NfcCardFrontProps) {
  const { front, stampsRequired, claimFriction } = content
  const brandParts = splitBrandName(front.brandName)

  return (
    <article
      className={`${styles.card} ${styles.front}`}
      aria-label={`${front.brandName} NFC card front`}
    >
      <div className={styles.cardInner}>
        <div className={styles.frontLeft}>
          <header>
            <p className={styles.brandEyebrow}>{front.brandEyebrow}</p>
            <h2 className={styles.brandName}>
              <i aria-hidden="true">✱</i>
              {brandParts.before}
              {brandParts.em ? <em>{brandParts.em}</em> : null}
              {brandParts.after}
            </h2>
            <p className={styles.venueLine}>{venue}</p>
          </header>

          <div className={styles.tapSealWrap}>
            <span className={styles.tapSealGhost} aria-hidden="true" />
            <div className={styles.tapSeal} aria-hidden="true">
              <p className={styles.tapSealWord}>{front.tapWord}</p>
              <p className={styles.tapSealSub}>{front.tapSub}</p>
            </div>
          </div>

          <div className={styles.frontLeftFoot}>
            <div className={styles.stampTrack} aria-hidden="true">
              <span className={`${styles.stampDot} ${styles.isWaiting}`}>
                01
              </span>
              {stampsRequired > 1 ? (
                <span className={`${styles.stampDot} ${styles.isEmpty}`}>
                  02
                </span>
              ) : null}
              <span className={styles.stampRail} />
              <span className={styles.stampN}>{stampsRequired}</span>
              <span className={styles.stampEq}>=</span>
              <span className={styles.stampReward}>Reward</span>
            </div>
            <p className={styles.stampCue}>{front.stampCue}</p>
          </div>
        </div>

        <aside className={styles.frontRight}>
          <header className={styles.claimHead}>
            <p className={styles.claimKicker}>{front.claimKicker}</p>
            <p className={styles.claimLine}>{front.claimLine}</p>
          </header>

          <ol className={styles.claimFlow} aria-label="How the card works">
            {front.flow.map((label, index) => (
              <li key={label}>
                <span aria-hidden="true">{index + 1}</span>
                <b>{label}</b>
              </li>
            ))}
          </ol>

          <div className={styles.claimQr}>
            {/* eslint-disable-next-line @next/next/no-img-element -- print QR data URL */}
            <img
              className={styles.qrImage}
              src={qrDataUrl}
              alt="Nabaperks join QR code"
              width={180}
              height={180}
            />
          </div>

          <p className={styles.claimFriction}>{claimFriction}</p>
        </aside>
      </div>
    </article>
  )
}

function splitBrandName(name: string): {
  before: string
  em: string | null
  after: string
} {
  const match = /^(.+?\s)(a)(\s.+)$/i.exec(name)
  if (!match) {
    return { before: name, em: null, after: "" }
  }
  return { before: match[1], em: match[2], after: match[3] }
}
