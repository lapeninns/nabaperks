import { VenueMark } from "@/components/brand/venue-mark"
import { StampDot } from "@/components/loyalty/stamp-dot"
import { resolveThermalContent } from "@/lib/qr/poster-content"

import { PosterWordmark } from "../poster-wordmark"
import styles from "./thermal-poster.module.css"
import { a4PosterStyle } from "../poster-copy"

function thermalSlotPx(stampsRequired: number): number {
  return Math.max(
    24,
    Math.min(42, Math.floor((431 - (stampsRequired - 1) * 10) / stampsRequired))
  )
}

type ThermalPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

export function ThermalPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: ThermalPosterProps) {
  const copy = resolveThermalContent(stampsRequired)
  const stamps = stampsRequired
  const business = businessName.trim()

  return (
    <article
      className={styles.sheet}
      style={{
        ...a4PosterStyle(copy),
        width: `${copy.geometry.sheetWidthMm}mm`,
        height: `${copy.geometry.sheetHeightMm}mm`,
        minHeight: `${copy.geometry.sheetHeightMm}mm`,
        maxHeight: `${copy.geometry.sheetHeightMm}mm`,
      }}
    >
      <div className={styles.counter}>
        <div className={styles.receipt}>
          <div aria-hidden="true" className={styles.tornTop} />

          <div className={styles.receiptInner}>
            <div className={styles.head}>
              <VenueMark name={business} size={44} />
              <p
                className={styles.bizName}
                data-poster-venue
                data-venue-fit={business.length > 44 ? "compact" : undefined}
              >
                {business}
              </p>
              <p className={styles.metaLine}>
                {copy.meta} / <PosterWordmark />
              </p>
            </div>

            <hr className={styles.ruleSolid} />
            <p className={styles.metaLine}>{copy.friction}</p>
            <hr className={styles.ruleDashed} />

            <p className={styles.hook}>{copy.headline}</p>

            <div className={styles.items}>
              {copy.items.map((item) => (
                <ReceiptItem
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  accent={item.accent}
                />
              ))}
            </div>

            <hr className={styles.ruleDashed} />
            <div className={styles.total}>
              <span>{copy.totalLabel}</span>
              <span>{copy.totalValue}</span>
            </div>
            <hr className={styles.ruleDashed} />

            <div className={styles.stamps}>
              <div className={styles.stampRow}>
                {Array.from({ length: stamps }, (_, index) => {
                  const offered = index === 0
                  const slotNumber = index + 1

                  return (
                    <span
                      key={slotNumber}
                      className={styles.stampSlot}
                      style={{ width: `${thermalSlotPx(stamps)}px` }}
                    >
                      <StampDot
                        earned={false}
                        label={
                          offered
                            ? "Stamp one starts after joining"
                            : `Stamp ${slotNumber} empty`
                        }
                        slotNumber={slotNumber}
                        showEmptySlotNumber
                        venueName={business}
                        className={offered ? styles.offeredStamp : undefined}
                      />
                    </span>
                  )
                })}
              </div>
            </div>

            <hr className={styles.ruleSolid} />

            <div className={styles.qrZone}>
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
              <p className={styles.scanLine}>{copy.qrCaption}</p>
            </div>

            <hr className={styles.ruleSolid} />

            <div className={styles.foot}>
              <p className={styles.metaLine}>{copy.reassurance}</p>
            </div>
          </div>

          <div aria-hidden="true" className={styles.tornBottom} />
        </div>
      </div>
    </article>
  )
}

function ReceiptItem({
  label,
  value,
  accent = false,
}: {
  readonly label: string
  readonly value: string
  readonly accent?: boolean
}) {
  return (
    <div className={styles.item}>
      <span className={styles.itemLabel}>{label}</span>
      <span aria-hidden="true" className={styles.leader} />
      <span
        className={`${styles.itemValue}${accent ? ` ${styles.itemValueAccent}` : ""}`}
      >
        {value}
      </span>
    </div>
  )
}
