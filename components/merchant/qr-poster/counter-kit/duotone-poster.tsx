import { resolveDuotoneContent } from "@/lib/qr/poster-content"
import type { DuotonePosterId } from "@/lib/qr/poster-kit-content-types"

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
import styles from "./duotone-poster.module.css"

type DuotonePosterProps = {
  readonly template: DuotonePosterId
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function DuotonePoster({
  template,
  qrDataUrl,
  businessName,
  stampsRequired,
}: DuotonePosterProps) {
  const copy = resolveDuotoneContent(template, stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.duotone)}
      data-spot={copy.spot}
      style={kitSheetStyle(copy)}
    >
      <div className={styles.top}>
        <KitMasthead
          className={styles.masthead}
          lead={<span>{copy.eyebrow}</span>}
          edition={<span>{copy.edition}</span>}
        />
        <h2 className={styles.headline}>{copy.headline}</h2>
        <p className={styles.lede}>{copy.lede}</p>
      </div>
      <div aria-hidden="true" className={styles.dots} />
      <div className={styles.panel}>
        <div className={styles.panelMain}>
          <KitQrPanel
            qrDataUrl={qrDataUrl}
            caption={copy.qrCaption}
            outerMm={copy.qr.outerMm}
          />
          <div className={styles.panelCopy}>
            <KitFrictionList lines={copy.friction} />
            <p className={styles.sealedLine}>{copy.sealedLine}</p>
          </div>
        </div>
        <div className={styles.venueStrip}>
          <KitBrandMark shape="glyph" />
          <KitVenueName venue={businessName} />
          <KitMemberTag tag={copy.memberTag} variant="plain" />
        </div>
        <KitFooter reassurance={copy.reassurance} />
      </div>
    </article>
  )
}
