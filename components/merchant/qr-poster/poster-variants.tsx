import styles from "./a4-poster.module.css"
import type { PosterCopy } from "./poster-copy"
import {
  FrictionBand,
  Headline,
  PosterFooter,
  PosterIdentity,
  QrBlock,
  QrProgress,
} from "./poster-pieces"

type PosterVariantProps = {
  readonly copy: PosterCopy
  readonly qrDataUrl: string
}

export function EditorialPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={styles.editorialLayout}>
      <PosterIdentity venue={copy.eyebrow} />
      <section className={styles.editorialHero}>
        <Headline className={styles.editorialHook} copy={copy} />
        <div className={styles.editorialWant}>
          <p>{copy.support}</p>
          <p>{copy.rewardDetail}</p>
        </div>
      </section>
      <section className={styles.editorialAction}>
        <div className={styles.editorialBelieve}>
          <FrictionBand text={copy.frictionLine} />
          <QrProgress copy={copy} />
        </div>
        <QrBlock
          qrDataUrl={qrDataUrl}
          title={copy.qrCaption}
          holderClassName={styles.editorialQrHolder}
          outerMm={copy.qrOuterMm}
        />
      </section>
      <PosterFooter copy={copy} />
    </div>
  )
}

export function BoldPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={styles.boldLayout}>
      <PosterIdentity venue={copy.eyebrow} />
      <section className={styles.boldHero}>
        <Headline className={styles.boldHook} copy={copy} />
        <p className={styles.boldQualification}>{copy.rewardDetail}</p>
      </section>
      <section className={styles.boldAction}>
        <div className={styles.boldBelieve}>
          <p>{copy.support}</p>
          <FrictionBand text={copy.frictionLine} />
          <QrProgress copy={copy} />
        </div>
        <QrBlock
          qrDataUrl={qrDataUrl}
          title={copy.qrCaption}
          holderClassName={styles.boldActionQr}
          outerMm={copy.qrOuterMm}
        />
      </section>
      <PosterFooter copy={copy} />
    </div>
  )
}

export function TicketPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={styles.ticketLayout}>
      <PosterIdentity venue={copy.eyebrow} />
      <section className={styles.ticketObject}>
        <div className={styles.ticketMainField}>
          <Headline className={styles.ticketObjectHook} copy={copy} />
          <p className={styles.ticketSupport}>{copy.support}</p>
          <p className={styles.ticketSealed}>{copy.rewardDetail}</p>
          <FrictionBand text={copy.frictionLine} />
          <QrProgress copy={copy} />
        </div>
        <div aria-hidden="true" className={styles.ticketPerforation} />
        <aside className={styles.ticketAudit}>
          <QrBlock
            qrDataUrl={qrDataUrl}
            title={copy.qrCaption}
            holderClassName={styles.ticketAuditQr}
            outerMm={copy.qrOuterMm}
          />
        </aside>
      </section>
      <PosterFooter copy={copy} />
    </div>
  )
}
