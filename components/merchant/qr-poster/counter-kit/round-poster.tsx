import { resolveRoundContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../poster-wordmark"
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
import styles from "./round-poster.module.css"

type RoundPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function RoundPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: RoundPosterProps) {
  const copy = resolveRoundContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.round)}
      style={kitSheetStyle(copy)}
    >
      <KitMasthead
        className={styles.masthead}
        lead={<span className={styles.mastheadLead}>{copy.eyebrow}</span>}
        edition={<span className={styles.mastheadEdition}>{copy.edition}</span>}
      />
      <h2 className={styles.headline}>
        {copy.headline.lead}{" "}
        <span className={styles.headlineAccent}>{copy.headline.accent}</span>
      </h2>
      <div className={styles.mid}>
        <div className={styles.midCopy}>
          <p className={styles.lede}>{copy.lede}</p>
          <p className={styles.sealedLine}>{copy.sealedLine}</p>
          <KitFrictionList lines={copy.friction} marked />
        </div>
        <div className={styles.mat}>
          <span aria-hidden="true" className={styles.matRing} />
          <div className={styles.matContent}>
            <span aria-hidden="true" className={styles.matMark}>
              ✱
            </span>
            <div className={styles.matLines}>
              {copy.matLines[0]}
              <br />
              {copy.matLines[1]}
              <br />
              {copy.matLines[2]}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.action}>
        <KitQrPanel
          qrDataUrl={qrDataUrl}
          caption={copy.qrCaption}
          outerMm={copy.qr.outerMm}
        />
        <div className={styles.brandCol}>
          <div className={styles.brandRow}>
            <KitBrandMark shape="roundel" />
            <PosterWordmark />
          </div>
          <KitVenueName venue={businessName} />
          <KitMemberTag tag={copy.memberTag} variant="outline" />
        </div>
      </div>
      <KitFooter reassurance={copy.reassurance} />
    </article>
  )
}
