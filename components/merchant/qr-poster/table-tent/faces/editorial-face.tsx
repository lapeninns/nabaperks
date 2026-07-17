import { resolveStudioTentContent } from "@/lib/qr/poster-content"

import styles from "../table-tent-poster.module.css"
import {
  CompactIdentity,
  CompactStampTrack,
  type TentFaceProps,
  tentFaceStyle,
} from "./shared"

/** Editorial landscape — N visits / one surprise + QR. */
export function EditorialTentFace({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TentFaceProps) {
  const content = resolveStudioTentContent(stampsRequired)
  const copy = content.faces.bottom
  const stamps = stampsRequired

  return (
    <section
      className={`${styles.face} ${styles.studioFace}`}
      style={tentFaceStyle(content)}
    >
      <CompactIdentity
        businessName={businessName}
        className={styles.studioIdentity}
      />
      <div className={styles.studioMain}>
        <div className={styles.studioPromise}>
          <h2 className={styles.studioHook}>{copy.headline}</h2>
          <p className={styles.studioSupport}>{copy.support}</p>
          <p className={styles.studioFriction}>{copy.frictionLine}</p>
          <CompactStampTrack stamps={stamps} venueName={businessName} />
        </div>

        <aside className={styles.studioClaim}>
          <p className={styles.studioCaption}>{copy.qrCaption}</p>
          <div
            className={styles.studioQrWrap}
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

      <footer className={styles.studioFooter}>{copy.reassurance}</footer>
    </section>
  )
}
