import { resolveBaseTentContent } from "@/lib/qr/poster-content"

import styles from "../table-tent-poster.module.css"
import {
  CompactIdentity,
  CompactStampTrack,
  type TentFaceProps,
  tentFaceStyle,
} from "./shared"

/** Landscape Ticket claim (A4 Ticket adapted to 176×125 mm). */
export function TicketTentFace({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TentFaceProps) {
  const content = resolveBaseTentContent(stampsRequired)
  const copy = content.faces.top
  const stamps = stampsRequired

  return (
    <section
      className={`${styles.face} ${styles.ticketFace}`}
      style={tentFaceStyle(content)}
    >
      <CompactIdentity
        businessName={businessName}
        className={styles.ticketStrap}
      />

      <div aria-hidden="true" className={styles.ticketTear}>
        <span />
        <i />
        <span />
      </div>

      <div className={styles.ticketBody}>
        <div className={styles.ticketPromise}>
          <h2 className={styles.ticketHook}>{copy.headline}</h2>
          <p className={styles.ticketSupport}>{copy.support}</p>
          <p className={styles.ticketFriction}>{copy.frictionLine}</p>
          <CompactStampTrack stamps={stamps} venueName={businessName} />
        </div>

        <aside className={styles.ticketClaim}>
          <p className={styles.ticketQrCaption}>{copy.qrCaption}</p>
          <div
            className={styles.ticketQrWrap}
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

      <footer className={styles.ticketFooter}>{copy.reassurance}</footer>
    </section>
  )
}
