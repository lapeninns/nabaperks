import { resolveLastcallContent } from "@/lib/qr/poster-content"

import {
  KitBrandMark,
  KitFooter,
  KitFrictionList,
  KitMasthead,
  KitMemberTag,
  KitQrPanel,
  kitSheetClass,
  kitSheetStyle,
  KitVenueName,
} from "./kit-pieces"
import styles from "./lastcall-poster.module.css"

type LastcallPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function LastcallPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: LastcallPosterProps) {
  const copy = resolveLastcallContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.lastcall)}
      style={kitSheetStyle(copy)}
    >
      <KitMasthead
        className={styles.masthead}
        lead={<span className={styles.mastheadLead}>{copy.eyebrow}</span>}
        edition={<span className={styles.mastheadEdition}>{copy.edition}</span>}
      />
      <div className={styles.headlineWrap}>
        <h2 className={styles.headline}>
          {copy.headline.lead}{" "}
          <span className={styles.headlineAccent}>{copy.headline.accent}</span>
        </h2>
        <span className={styles.badge}>{copy.badge}</span>
      </div>
      <p className={styles.lede}>{copy.lede}</p>
      <div className={styles.mid}>
        <div className={styles.qrCard}>
          <KitQrPanel
            qrDataUrl={qrDataUrl}
            caption={copy.qrCaption}
            outerMm={copy.qr.outerMm}
          />
        </div>
        <div className={styles.midCopy}>
          <KitFrictionList lines={copy.friction} marked />
          <p className={styles.sealedLine}>{copy.sealedLine}</p>
        </div>
      </div>
      <div className={styles.venueStrip}>
        <KitBrandMark shape="roundel" />
        <KitVenueName venue={businessName} />
        <KitMemberTag tag={copy.memberTag} variant="outline" />
      </div>
      <KitFooter reassurance={copy.reassurance} />
    </article>
  )
}
