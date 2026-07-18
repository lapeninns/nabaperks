import { resolvePinnedContent } from "@/lib/qr/poster-content"

import {
  KitFooter,
  KitFrictionList,
  KitMasthead,
  KitMemberTag,
  KitQrPanel,
  kitSheetClass,
  kitSheetStyle,
  KitVenueName,
} from "./kit-pieces"
import styles from "./pinned-poster.module.css"

const STUB_COUNT = 6

type PinnedPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function PinnedPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: PinnedPosterProps) {
  const copy = resolvePinnedContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.pinned)}
      style={kitSheetStyle(copy)}
    >
      <div className={styles.note}>
        <span aria-hidden="true" className={styles.pin} />
        <KitMasthead
          className={styles.masthead}
          lead={<span className={styles.mastheadLead}>{copy.eyebrow}</span>}
          edition={
            <span className={styles.mastheadEdition}>{copy.edition}</span>
          }
        />
        <div className={styles.headlineWrap}>
          <span aria-hidden="true" className={styles.headlineEcho}>
            {copy.headline}
          </span>
          <h2 className={styles.headline}>{copy.headline}</h2>
        </div>
        <p className={styles.lede}>{copy.lede}</p>
        <div className={styles.action}>
          <KitQrPanel
            qrDataUrl={qrDataUrl}
            caption={copy.qrCaption}
            outerMm={copy.qr.outerMm}
          />
          <div className={styles.actionCopy}>
            <KitFrictionList lines={copy.friction} marked />
            <div className={styles.venueBlock}>
              <KitVenueName venue={businessName} />
              <KitMemberTag tag={copy.memberTag} variant="pill" />
            </div>
          </div>
        </div>
        <div aria-hidden="true" className={styles.stubs}>
          {Array.from({ length: STUB_COUNT }, (_, index) => (
            <span key={index} className={styles.stub}>
              {copy.stubTop}
              <br />
              {copy.stubBottom}
            </span>
          ))}
        </div>
      </div>
      <KitFooter reassurance={copy.reassurance} />
    </article>
  )
}
