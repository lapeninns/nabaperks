import { resolveSealContent } from "@/lib/qr/poster-content"

import {
  KitFooter,
  KitLedgerVenueBlock,
  KitMasthead,
  KitQrPanel,
  kitSheetClass,
  kitSheetStyle,
} from "./kit-pieces"
import styles from "./seal-poster.module.css"

type SealPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function SealPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: SealPosterProps) {
  const copy = resolveSealContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.seal)}
      data-body="mono"
      style={kitSheetStyle(copy)}
    >
      <KitMasthead
        className={styles.masthead}
        lead={<span>{copy.manifestLabel}</span>}
        edition={<span>{copy.edition}</span>}
      />
      <h2 className={styles.headline}>{copy.headline}</h2>
      <div className={styles.manifest}>
        {copy.rows.map((row) => (
          <div
            key={row.label}
            className={styles.row}
            data-accent={row.accent ? "true" : undefined}
          >
            <span className={styles.rowLabel}>{row.label}</span>
            {row.redacted ? (
              <>
                <span aria-hidden="true" className={styles.redaction} />
                <span className={styles.sealedPill}>{copy.sealedTag}</span>
              </>
            ) : (
              <span className={styles.rowValue}>{row.value}</span>
            )}
          </div>
        ))}
        <p className={styles.frictionLine}>{copy.frictionLine}</p>
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
