import { resolveNightTentContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../../poster-wordmark"
import styles from "../table-tent-poster.module.css"
import { CompactStampTrack, type TentFaceProps, tentFaceStyle } from "./shared"

/** Night card — Northstar adapted to landscape B5 face. */
export function NightTentFace({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TentFaceProps) {
  const content = resolveNightTentContent(stampsRequired)
  const copy = content.faces.bottom
  const stamps = stampsRequired
  const accentStart = copy.headline.indexOf(copy.headlineAccent)

  return (
    <section
      className={`${styles.face} ${styles.nightFace} dark`}
      style={tentFaceStyle(content)}
    >
      <header className={styles.nightIdentity}>
        <p
          className={styles.nightVenue}
          data-poster-venue
          data-venue-fit={
            businessName.trim().length > 44 ? "compact" : undefined
          }
        >
          {businessName}
        </p>
        <PosterWordmark className={styles.identityBrand} />
      </header>

      <div className={styles.nightMain}>
        <span className={styles.nightChip}>{copy.chip}</span>
        <div className={styles.nightPromise}>
          <h2 className={styles.nightHook}>
            {copy.headline.slice(0, accentStart)}
            <span className={styles.nightAccent}>{copy.headlineAccent}</span>
            {copy.headline.slice(accentStart + copy.headlineAccent.length)}
          </h2>
          <p className={styles.nightEase}>{copy.ease}</p>
          <p className={styles.nightWhisper}>{copy.promise}</p>
          <CompactStampTrack stamps={stamps} venueName={businessName} />
        </div>

        <aside className={styles.nightCard}>
          <p className={styles.nightCaption}>{copy.qrCaption}</p>
          <div
            className={styles.nightQrWrap}
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
        </aside>
      </div>

      <footer className={styles.nightFooter}>{copy.reassurance}</footer>
    </section>
  )
}
