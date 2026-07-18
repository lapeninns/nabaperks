import { VenueMark } from "@/components/brand/venue-mark"
import { StampDot } from "@/components/loyalty/stamp-dot"
import { resolveNorthstarContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../poster-wordmark"
import styles from "./northstar-poster.module.css"
import { a4PosterStyle } from "../poster-copy"

type NorthStarPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function NorthStarPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: NorthStarPosterProps) {
  const copy = resolveNorthstarContent(stampsRequired)
  const stamps = stampsRequired
  const stampVenue = businessName
  const accentStart = copy.headline.indexOf(copy.headlineAccent)

  return (
    <article
      className={`${styles.sheet} dark`}
      style={{
        ...a4PosterStyle(copy),
        width: `${copy.geometry.sheetWidthMm}mm`,
        height: `${copy.geometry.sheetHeightMm}mm`,
        minHeight: `${copy.geometry.sheetHeightMm}mm`,
        maxHeight: `${copy.geometry.sheetHeightMm}mm`,
      }}
    >
      <div className={styles.frame}>
        <header className={styles.identity}>
          <VenueMark name={stampVenue} size={48} />
          <p
            className={styles.venueName}
            data-poster-venue
            data-venue-fit={
              businessName.trim().length > 44 ? "compact" : undefined
            }
          >
            {businessName}
          </p>
          <PosterWordmark className={styles.systemName} />
        </header>

        <section className={styles.cardHero}>
          <span aria-hidden="true" className={styles.cardChip}>
            {copy.chip}
          </span>
          <h2 className={styles.hook}>
            {copy.headline.slice(0, accentStart)}
            <span className={styles.hookAccent}>{copy.headlineAccent}</span>
            {copy.headline.slice(accentStart + copy.headlineAccent.length)}
          </h2>
          <hr className={styles.cardRule} />
          <div className={styles.stampRow}>
            {Array.from({ length: stamps }, (_, index) => {
              const offered = index === 0
              const slotNumber = index + 1

              return (
                <span key={slotNumber} className={styles.stampSlot}>
                  <StampDot
                    earned={false}
                    label={
                      offered
                        ? "Stamp one starts after joining"
                        : `Stamp ${slotNumber} empty`
                    }
                    slotNumber={slotNumber}
                    showEmptySlotNumber
                    venueName={stampVenue}
                    className={offered ? styles.offeredStamp : undefined}
                  />
                </span>
              )
            })}
          </div>
          <div className={styles.cardBottom}>
            <div className={styles.belief}>
              <p className={styles.promise}>{copy.promise}</p>
              <p className={styles.ease}>{copy.ease}</p>
            </div>
            <div className={styles.actionLane}>
              <p className={styles.caption}>{copy.qrCaption}</p>
              <div
                className={styles.qrField}
                style={{
                  width: `${copy.qr.outerMm}mm`,
                  height: `${copy.qr.outerMm}mm`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
                <img
                  src={qrDataUrl}
                  alt="Nabaperks QR code"
                  width={900}
                  height={900}
                />
              </div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>{copy.reassurance}</span>
        </footer>
      </div>
    </article>
  )
}
