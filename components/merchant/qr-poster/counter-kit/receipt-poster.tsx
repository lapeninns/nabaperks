import { resolveReceiptContent } from "@/lib/qr/poster-content"

import {
  KitMasthead,
  KitMemberTag,
  KitQrPanel,
  kitSheetClass,
  kitSheetStyle,
  KitVenueName,
} from "./kit-pieces"
import styles from "./receipt-poster.module.css"

type ReceiptPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function ReceiptPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: ReceiptPosterProps) {
  const copy = resolveReceiptContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.receipt)}
      data-body="mono"
      style={kitSheetStyle(copy)}
    >
      <div className={styles.strip}>
        <span aria-hidden="true" className={styles.perforation} />
        <KitMasthead
          className={styles.masthead}
          lead={<span className={styles.mastheadLead}>{copy.orderLabel}</span>}
          edition={
            <span className={styles.mastheadEdition}>{copy.edition}</span>
          }
        />
        <h2 className={styles.hook}>{copy.hook}</h2>
        <div className={styles.merchant}>
          <span className={styles.merchantLabel}>{copy.merchantLabel}</span>
          <KitVenueName venue={businessName} />
          <KitMemberTag tag={copy.memberTag} variant="pill" />
        </div>
        <div className={styles.cardLine}>{copy.cardLine}</div>
        <ul className={styles.items}>
          <li className={styles.itemRow}>
            <span>{copy.todayItem}</span>
            <span aria-hidden="true" className={styles.leader} />
            <span>{copy.todayValue}</span>
          </li>
          {Array.from({ length: stampsRequired - 1 }, (_, index) => (
            <li key={index} aria-hidden="true" className={styles.slotRow} />
          ))}
          <li className={styles.itemRow}>
            <span>{copy.rewardItem}</span>
            <span aria-hidden="true" className={styles.leader} />
            <span className={styles.rewardValue}>
              <span aria-hidden="true" className={styles.rewardSeal}>
                ?
              </span>
              {copy.rewardValue}
            </span>
          </li>
        </ul>
        <p className={styles.rewardNote}>{copy.rewardNote}</p>
        <div className={styles.total}>
          <span className={styles.totalLabel}>
            <span aria-hidden="true" className={styles.totalMark}>
              ✱
            </span>
            {copy.totalLabel}
          </span>
          <span>{copy.totalValue}</span>
        </div>
        <ol className={styles.footnotes}>
          {copy.footnotes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <div className={styles.qrBlock}>
          <KitQrPanel
            qrDataUrl={qrDataUrl}
            caption={copy.qrCaption}
            outerMm={copy.qr.outerMm}
          />
        </div>
        <div className={styles.footLine}>{copy.footLine}</div>
        <footer className={styles.reassurance}>{copy.reassurance}</footer>
        <span aria-hidden="true" className={styles.perforation} />
      </div>
    </article>
  )
}
