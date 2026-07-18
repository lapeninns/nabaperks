import { resolvePrimerContent } from "@/lib/qr/poster-content"

import {
  KitFooter,
  KitLedgerVenueBlock,
  KitMasthead,
  KitQrPanel,
  kitSheetClass,
  kitSheetStyle,
} from "./kit-pieces"
import styles from "./primer-poster.module.css"

type PrimerPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function PrimerPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: PrimerPosterProps) {
  const copy = resolvePrimerContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.primer)}
      data-body="mono"
      style={kitSheetStyle(copy)}
    >
      <KitMasthead
        className={styles.masthead}
        lead={<span>{copy.ledgerLabel}</span>}
        edition={<span>{copy.edition}</span>}
      />
      <h2 className={styles.headline}>{copy.headline}</h2>
      <div className={styles.clauses}>
        {copy.clauses.map((clause) => (
          <div
            key={clause.number}
            className={styles.clause}
            data-sealed={clause.sealed ? "true" : undefined}
          >
            <span className={styles.clauseNumber}>{clause.number}</span>
            <div className={styles.clauseBody}>
              <div className={styles.clauseTitle}>{clause.title}</div>
              <p className={styles.clauseDetail}>{clause.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.action}>
        <KitQrPanel
          qrDataUrl={qrDataUrl}
          caption={copy.qrCaption}
          outerMm={copy.qr.outerMm}
        />
        <KitLedgerVenueBlock
          issuerLabel={copy.issuerLabel}
          memberTag={copy.memberTag}
          venue={businessName}
          signature={copy.signature}
        />
      </div>
      <KitFooter reassurance={copy.reassurance} className={styles.legal} />
    </article>
  )
}
