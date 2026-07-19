import { resolveChalkContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../poster-wordmark"
import {
  KitBrandMark,
  KitFooter,
  KitMasthead,
  KitMemberTag,
  KitQrPanel,
  kitSheetClass,
  kitSheetStyle,
  KitVenueName,
} from "./kit-pieces"
import styles from "./chalk-poster.module.css"

type ChalkPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

function ChalkCircle({
  index,
  todayLabel,
}: {
  readonly index: number
  readonly todayLabel: string
}) {
  if (index === 0) {
    return (
      <span className={`${styles.circle} ${styles.circleToday}`}>
        {todayLabel}
      </span>
    )
  }
  return <span className={styles.circle} />
}

export function ChalkPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: ChalkPosterProps) {
  const copy = resolveChalkContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.chalk)}
      style={kitSheetStyle(copy)}
    >
      <span aria-hidden="true" className={styles.frame} />
      <KitMasthead
        className={styles.masthead}
        lead={<span className={styles.mastheadLead}>{copy.eyebrow}</span>}
        edition={<span className={styles.mastheadEdition}>{copy.edition}</span>}
      />
      <div className={styles.headlineWrap}>
        <h2 className={styles.headline}>{copy.headline}</h2>
        <span aria-hidden="true" className={styles.underline} />
      </div>
      <p className={styles.rowNote}>{copy.rowNote}</p>
      <div aria-hidden="true" className={styles.circles}>
        {Array.from({ length: stampsRequired }, (_, index) => (
          <ChalkCircle key={index} index={index} todayLabel={copy.todayLabel} />
        ))}
        <span className={`${styles.circle} ${styles.circleSeal}`}>?</span>
      </div>
      <p className={styles.sealedLine}>{copy.sealedLine}</p>
      <div className={styles.action}>
        <div className={styles.qrBox}>
          <KitQrPanel
            qrDataUrl={qrDataUrl}
            caption={copy.qrCaption}
            outerMm={copy.qr.outerMm}
          />
        </div>
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
