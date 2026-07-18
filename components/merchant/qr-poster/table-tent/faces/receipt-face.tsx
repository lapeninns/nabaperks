import { resolveNightTentContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../../poster-wordmark"
import styles from "../table-tent-poster.module.css"
import { type TentFaceProps, tentFaceStyle } from "./shared"

/** Thermal receipt — abbreviated for landscape B5 face. */
export function ReceiptTentFace({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TentFaceProps) {
  const content = resolveNightTentContent(stampsRequired)
  const copy = content.faces.top

  return (
    <section
      className={`${styles.face} ${styles.receiptFace}`}
      style={tentFaceStyle(content)}
    >
      <header className={styles.receiptHead}>
        <p
          className={styles.receiptBiz}
          data-poster-venue
          data-venue-fit={
            businessName.trim().length > 44 ? "compact" : undefined
          }
        >
          {businessName}
        </p>
        <p className={styles.receiptMeta}>
          <PosterWordmark accentClassName={styles.receiptBrandAccent} /> ·{" "}
          {copy.meta}
        </p>
      </header>

      <div className={styles.receiptMain}>
        <div className={styles.receiptLedger}>
          <p className={styles.receiptHook}>{copy.headline}</p>
          <div className={styles.receiptItems}>
            {copy.items.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
          <div className={styles.receiptTotal}>
            <span>{copy.totalLabel}</span>
            <span>{copy.totalValue}</span>
          </div>
          <p className={styles.receiptFriction}>{copy.friction}</p>
        </div>

        <aside className={styles.receiptClaim}>
          <p className={styles.receiptScan}>{copy.qrCaption}</p>
          <div
            className={styles.receiptQrWrap}
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

      <footer className={styles.receiptFooter}>{copy.reassurance}</footer>
    </section>
  )
}
