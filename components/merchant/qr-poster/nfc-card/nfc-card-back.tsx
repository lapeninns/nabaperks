import type { NfcCardContent } from "@/lib/qr/nfc-card-content"

import styles from "./nfc-card-back.module.css"

type NfcCardBackProps = {
  readonly content: NfcCardContent
  readonly venue: string
}

/**
 * CR80 back — calm keep-and-return companion to the tap-forward front.
 * One hero tease, a connected journey rail (not three boxed cards), soft meta.
 * Layout is CSS-module grid only — no preview transforms on this face.
 */
export function NfcCardBack({ content, venue }: NfcCardBackProps) {
  const { back, friction, dieRule } = content

  return (
    <article
      className={styles.card}
      data-nfc-face="back"
      aria-label={`${content.front.brandName} NFC card back`}
    >
      <div className={styles.cardInner}>
        <header className={styles.meta}>
          <p className={styles.strap}>{back.strap}</p>
          <div className={styles.metaEnd}>
            <b className={styles.badge}>{back.badge}</b>
            <span className={styles.venue}>{venue}</span>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.hero}>
            <p className={styles.tease}>
              {back.teaseLead}
              <br />
              <em>{back.teaseAccent}</em>
            </p>
            <div className={styles.seal} aria-hidden="true">
              <span>{back.sealLabel}</span>
            </div>
          </div>

          <ol className={styles.rail} aria-label="How to use this card">
            {back.steps.map((step, index) => (
              <li key={step.title} className={styles.railStep}>
                {index > 0 ? (
                  <span className={styles.railJoin} aria-hidden="true" />
                ) : null}
                <span className={styles.railN} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.railCopy}>
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className={styles.friction}>{friction}</p>
        </div>

        <footer className={styles.foot}>
          <strong>{back.footBrand}</strong>
          <span>{dieRule}</span>
        </footer>
      </div>
    </article>
  )
}
