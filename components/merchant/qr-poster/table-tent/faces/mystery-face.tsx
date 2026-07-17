import { resolveBaseTentContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../../poster-wordmark"
import styles from "../table-tent-poster.module.css"
import { CompactStampTrack, type TentFaceProps, tentFaceStyle } from "./shared"

/** Mystery ritual + vermillion scan panel. Copy from config/poster-designs.json. */
export function MysteryTentFace({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TentFaceProps) {
  const content = resolveBaseTentContent(stampsRequired)
  const copy = content.faces.bottom
  const stamps = stampsRequired

  return (
    <section className={styles.face} style={tentFaceStyle(content)}>
      <header className={styles.brandBar}>
        <div className={styles.wordmark}>
          <span aria-hidden="true" className={styles.wordmarkMark}>
            ✱
          </span>
          <PosterWordmark accentClassName={styles.wordmarkAccent} />
        </div>
        <div className={styles.edition}>{copy.editionLabel}</div>
      </header>

      <div className={styles.main}>
        <div className={styles.promise}>
          <p
            className={styles.venueLine}
            data-poster-venue
            data-venue-fit={
              businessName.trim().length > 44 ? "compact" : undefined
            }
          >
            {businessName}
          </p>

          <h2 className={styles.stack}>
            <span>{copy.stack[0]}</span>
            <span>{copy.stack[1]}</span>
            <span className={styles.unlock}>{copy.stack[2]}</span>
          </h2>

          <div className={styles.rewardRow}>
            <CompactStampTrack stamps={stamps} venueName={businessName} />
            <p className={styles.rewardCopy}>{copy.rewardLine}</p>
          </div>
        </div>

        <aside className={styles.scan}>
          <div className={styles.scanHeading}>
            <span>{copy.scanLabel}</span>
            <span aria-hidden="true" className={styles.scanArrow}>
              →
            </span>
          </div>

          <div
            className={styles.qrWrap}
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

          <div className={styles.scanBottom}>
            <p>
              {copy.scanCta[0]}
              <br />
              {copy.scanCta[1]}
            </p>
            <span className={styles.noApp}>{copy.frictionLine}</span>
          </div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <span>{copy.footerLeft}</span>
        <span className={styles.footerCentre}>
          <span aria-hidden="true" className={styles.footerMark}>
            ✱
          </span>
          {copy.footerCentre}
        </span>
        <span className={styles.footerEnd}>{copy.footerRight}</span>
      </footer>
    </section>
  )
}
