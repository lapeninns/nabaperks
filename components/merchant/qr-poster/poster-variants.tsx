import styles from "./a4-poster.module.css"
import type { PosterCopy } from "./poster-copy"
import {
  FrictionBand,
  Headline,
  PosterFooter,
  QrBlock,
  QrProgress,
  TearLine,
} from "./poster-pieces"

type PosterVariantProps = {
  readonly copy: PosterCopy
  readonly qrDataUrl: string
}

/** Editorial — light counter card, single-message conversion flow. */
export function EditorialPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={`${styles.card} surface-card`}>
      <div className={styles.convTop}>
        <p className={styles.venueEyebrow}>{copy.eyebrow}</p>
        <Headline className={styles.hook} copy={copy} />
        <p className={styles.nowValue}>{copy.support}</p>
        <p className={styles.forbidden}>{copy.forbidden}</p>
      </div>

      <FrictionBand text={copy.frictionLine} />

      <div className={styles.convMain}>
        <QrBlock
          qrDataUrl={qrDataUrl}
          title={copy.qrCaption}
          holderClassName={styles.convQrHolder}
          footer={<QrProgress copy={copy} />}
        />
      </div>

      <PosterFooter copy={copy} />
    </div>
  )
}

/** Bold — the primary conversion poster: one giant promise, one giant QR. */
export function BoldPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={styles.boldInner}>
      <div className={styles.convTop}>
        <p className={styles.venueEyebrow}>{copy.eyebrow}</p>
        <Headline className={styles.hook} copy={copy} />
        <p className={styles.nowValue}>{copy.support}</p>
        <p className={styles.forbidden}>{copy.forbidden}</p>
      </div>

      <FrictionBand text={copy.frictionLine} />

      <div className={styles.convMain}>
        <QrBlock
          qrDataUrl={qrDataUrl}
          title={copy.qrCaption}
          holderClassName={styles.boldQrHolder}
          footer={<QrProgress copy={copy} />}
        />
      </div>

      <PosterFooter copy={copy} />
    </div>
  )
}

/** Ticket — claim-your-first-stamp urgency: the promise rides the strap. */
export function TicketPoster({ copy, qrDataUrl }: PosterVariantProps) {
  return (
    <div className={`${styles.card} surface-card`}>
      <section className={styles.ticketStrap}>
        <p className={`${styles.venueEyebrow} ${styles.onAccent}`}>
          {copy.eyebrow}
        </p>
        <Headline className={`${styles.hook} ${styles.ticketHook}`} copy={copy} />
        <p className={`${styles.nowValue} ${styles.onAccent}`}>{copy.support}</p>
        <p className={`${styles.forbidden} ${styles.onAccent}`}>{copy.forbidden}</p>
      </section>

      <TearLine />

      <section className={styles.ticketBody}>
        <span aria-hidden="true" className={styles.coffeeRing} />
        <FrictionBand text={copy.frictionLine} />
        <div className={styles.ticketClaim}>
          <QrBlock
            qrDataUrl={qrDataUrl}
            title={copy.qrCaption}
            holderClassName={styles.ticketQrHolder}
            footer={<QrProgress copy={copy} />}
          />
        </div>
      </section>

      <PosterFooter copy={copy} />
    </div>
  )
}
