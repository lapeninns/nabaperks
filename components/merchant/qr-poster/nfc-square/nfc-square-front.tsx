import type { NfcSquareContent } from "@/lib/qr/nfc-square-content"

import styles from "./nfc-square-front.module.css"

type NfcSquareFrontProps = {
  readonly content: NfcSquareContent
  readonly venue: string
  readonly qrDataUrl: string
}

/**
 * 100×100 mm wall plate — venue hero, TAP action, proof band (mystery + steps + QR).
 */
export function NfcSquareFront({
  content,
  venue,
  qrDataUrl,
}: NfcSquareFrontProps) {
  const { front, stampsRequired, claimFriction, friction, dieRule } = content
  const brandParts = splitBrandName(front.brandName)

  return (
    <article
      className={styles.plate}
      data-nfc-face="square-front"
      aria-label={`${front.brandName} wall NFC plate`}
    >
      <header className={styles.hero}>
        <p className={styles.brandEyebrow}>{front.brandEyebrow}</p>
        <h2 className={styles.brandName}>
          <i aria-hidden="true">✱</i>
          {brandParts.before}
          {brandParts.em ? <em>{brandParts.em}</em> : null}
          {brandParts.after}
        </h2>
        <p className={styles.venueLine}>{venue}</p>
      </header>

      <section className={styles.action} aria-label="Tap to join">
        <div className={styles.inkField} aria-hidden="true">
          <span className={styles.inkShadow} />
          <div className={styles.inkBlock}>
            <p className={styles.tapWord}>{front.tapWord}</p>
            <p className={styles.tapSub}>{front.tapSub}</p>
          </div>
        </div>
        <p className={styles.claimLine}>{front.claimLine}</p>
      </section>

      <section className={styles.proof} aria-label="How it works">
        <div className={styles.proofCopy}>
          <div className={styles.mystery}>
            <p className={styles.mysteryKicker}>{front.mysteryKicker}</p>
            <p className={styles.mysteryAccent}>{front.mysteryAccent}</p>
          </div>

          <ol className={styles.flow} aria-label="How the plate works">
            {front.flow.map((label, index) => (
              <li key={label}>
                <span aria-hidden="true">{index + 1}</span>
                <b>{label}</b>
              </li>
            ))}
          </ol>

          <div className={styles.stampTrack} aria-hidden="true">
            <span className={`${styles.stampDot} ${styles.isWaiting}`}>01</span>
            {stampsRequired > 1 ? (
              <span className={`${styles.stampDot} ${styles.isEmpty}`}>02</span>
            ) : null}
            <span className={styles.stampRail} />
            <span className={styles.stampN}>{stampsRequired}</span>
            <span className={styles.stampEq}>=</span>
            <span className={styles.stampReward}>Reward</span>
          </div>

          <p className={styles.friction}>{friction}</p>
          <p className={styles.dieRule}>{dieRule}</p>
        </div>

        <div className={styles.qrPad}>
          {/* eslint-disable-next-line @next/next/no-img-element -- print QR data URL */}
          <img
            className={styles.qrImage}
            src={qrDataUrl}
            alt="Nabaperks join QR code"
            width={200}
            height={200}
            style={{
              width: `${content.geometry.qrOuterMm}mm`,
              height: `${content.geometry.qrOuterMm}mm`,
            }}
          />
          <p className={styles.claimFriction}>{claimFriction}</p>
        </div>
      </section>
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
