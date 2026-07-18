import { resolveTallyContent } from "@/lib/qr/poster-content"

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
import styles from "./tally-poster.module.css"

type TallyPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

function TallyCircle({
  index,
  count,
  todayLabel,
}: {
  readonly index: number
  readonly count: number
  readonly todayLabel: string
}) {
  const sealed = index === count - 1
  const today = index === 0

  if (sealed) {
    return (
      <span
        className={`${styles.circle} ${styles.circleSeal}`}
        data-today={today ? "true" : undefined}
      >
        {today ? todayLabel : "✱"}
      </span>
    )
  }
  if (today) {
    return (
      <span className={`${styles.circle} ${styles.circleToday}`}>
        {todayLabel}
      </span>
    )
  }
  return <span className={styles.circle} />
}

export function TallyPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TallyPosterProps) {
  const copy = resolveTallyContent(stampsRequired)

  return (
    <article
      className={kitSheetClass(styles.tally)}
      style={kitSheetStyle(copy)}
    >
      <KitMasthead
        className={styles.masthead}
        lead={<span className={styles.mastheadLead}>{copy.eyebrow}</span>}
        edition={<span className={styles.mastheadEdition}>{copy.edition}</span>}
      />
      <div className={styles.headlineWrap}>
        <span aria-hidden="true" className={styles.headlineEcho}>
          {copy.headline}
        </span>
        <h2 className={styles.headline}>{copy.headline}</h2>
      </div>
      <div className={styles.card}>
        <div className={styles.cardMeta}>
          <span>{copy.cardLabel}</span>
          <span>{copy.cardCount}</span>
        </div>
        <div aria-hidden="true" className={styles.circles}>
          {Array.from({ length: stampsRequired }, (_, index) => (
            <TallyCircle
              key={index}
              index={index}
              count={stampsRequired}
              todayLabel={copy.todayLabel}
            />
          ))}
        </div>
        <p className={styles.explainer}>{copy.explainer}</p>
      </div>
      <div className={styles.action}>
        <KitQrPanel
          qrDataUrl={qrDataUrl}
          caption={copy.qrCaption}
          outerMm={copy.qr.outerMm}
        />
        <div className={styles.actionCopy}>
          <KitFrictionList lines={copy.friction} marked />
          <div className={styles.dateRule}>{copy.dateRule}</div>
          <div className={styles.venueBlock}>
            <KitVenueName venue={businessName} />
            <KitMemberTag tag={copy.memberTag} variant="pill" />
          </div>
        </div>
      </div>
      <KitFooter reassurance={copy.reassurance} />
    </article>
  )
}
