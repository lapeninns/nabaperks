import { resolveChalkContent } from "@/lib/qr/poster-content"

import {
  KitMemberTag,
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

const STUB_TONES: readonly string[] = ["vermillion", "sun", "leaf"]

function ChalkStub({
  number,
  top,
  bottom,
}: {
  readonly number: number
  readonly top: string
  readonly bottom: string
}) {
  return (
    <div
      className={styles.stub}
      data-tone={STUB_TONES[(number - 1) % STUB_TONES.length]}
    >
      <span className={styles.stubNumber}>{number}</span>
      <span className={styles.stubTop}>{top}</span>
      <span className={styles.stubBottom}>{bottom}</span>
      <span aria-hidden="true" className={styles.stubUnderline} />
    </div>
  )
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
      <header className={styles.masthead}>
        <span className={styles.mastheadLead}>{copy.eyebrow}</span>
        <span className={styles.mastheadEdition}>{copy.edition}</span>
      </header>
      <div className={styles.headlineWrap}>
        <h2 className={styles.headline}>
          {copy.headline.lead}
          <br />
          <span className={styles.headlineAccent}>{copy.headline.accent}</span>
          <span aria-hidden="true" className={styles.smiley} />
        </h2>
      </div>
      <p className={styles.lede}>{copy.lede}</p>
      <p className={styles.sealedLine}>{copy.sealedLine}</p>
      <div className={styles.mid}>
        <div className={styles.qrCol}>
          <div className={styles.qrBox}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
            <img
              src={qrDataUrl}
              alt="Nabaperks QR code"
              width={900}
              height={900}
              style={{
                width: `${copy.qr.outerMm}mm`,
                height: `${copy.qr.outerMm}mm`,
              }}
            />
          </div>
          <p className={styles.qrCaption}>
            <span aria-hidden="true" className={styles.arrow} />
            {copy.qrCaption}
          </p>
        </div>
        <div className={styles.sideCol}>
          <ul className={styles.friction}>
            {copy.friction.map((line) => (
              <li key={line} className={styles.frictionRow}>
                <span aria-hidden="true" className={styles.frictionMark}>
                  ✱
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className={styles.venueBlock}>
            <span aria-hidden="true" className={styles.pint} />
            <div className={styles.venueStack}>
              <KitVenueName venue={businessName} />
              <KitMemberTag tag={copy.memberTag} variant="outline" />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.cutLine}>
        <span aria-hidden="true" className={styles.scissors} />
      </div>
      <div className={styles.stubRow}>
        {Array.from({ length: stampsRequired }, (_, index) => (
          <ChalkStub
            key={index}
            number={index + 1}
            top={copy.stubTop}
            bottom={copy.stubBottom}
          />
        ))}
      </div>
      <footer className={styles.foot}>
        <span className={styles.ageRoundel}>18+</span>
        <span className={styles.reassurance}>{copy.reassurance}</span>
        <span aria-hidden="true" className={styles.padlock} />
      </footer>
    </article>
  )
}
