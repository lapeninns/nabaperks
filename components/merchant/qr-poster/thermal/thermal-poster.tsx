import type { CSSProperties } from "react"

import { VenueMark } from "@/components/brand/venue-mark"
import { StampDot } from "@/components/loyalty/stamp-dot"

import styles from "./thermal-poster.module.css"

/**
 * Thermal-receipt concept — the poster IS a till receipt torn from the roll.
 *
 * Space Mono throughout (the product's "printed" register), with the offer
 * itemised like a transaction: first stamp FREE, reward LOCKED, total to join
 * £0.00, and the QR as the receipt's scan code. Mystery is never named — the
 * reward reads "LOCKED". One narrow receipt strip, serrated top and bottom,
 * centred on a deeper-paper counter.
 *
 * Robustness: the stamp row sizes its slots to the count so it stays one line
 * (constant receipt height); the venue name is the big spoken line with the
 * location dropped to a mono address line below it.
 */

const POSTER_STAMP_TILTS = ["-7deg", "-5deg", "-8deg", "-6deg"] as const

/** Address line below the name — only when it adds detail the name doesn't. */
function locationMetaOf(
  businessName: string,
  locationName: string
): string | null {
  const business = businessName.trim()
  const location = locationName.trim()

  if (
    !location ||
    location === business ||
    business.includes(location) ||
    location.includes(business)
  ) {
    return null
  }

  return location
}

/** Slot px that keeps the stamp row to a single line in the receipt strip. */
function thermalSlotPx(stampsRequired: number): number {
  return Math.max(
    24,
    Math.min(42, Math.floor((431 - (stampsRequired - 1) * 10) / stampsRequired))
  )
}

type ThermalPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly locationName: string
  readonly stampsRequired: number
}

export function ThermalPoster({
  qrDataUrl,
  businessName,
  locationName,
  stampsRequired,
}: ThermalPosterProps) {
  const stamps = Math.max(1, stampsRequired)
  const business = businessName.trim()
  const address = locationMetaOf(businessName, locationName)
  const visitWord = stamps === 1 ? "Visit" : "Visits"

  return (
    <article className={styles.sheet}>
      <div className={styles.counter}>
        <div className={styles.receipt}>
          <div aria-hidden="true" className={styles.tornTop} />

          <div className={styles.receiptInner}>
            <div className={styles.head}>
              <VenueMark name={business} size={44} />
              <p className={styles.bizName}>{business}</p>
              {address ? <p className={styles.metaLine}>{address}</p> : null}
              <p className={styles.metaLine}>Loyalty receipt</p>
            </div>

            <hr className={styles.ruleSolid} />
            <p className={styles.metaLine}>No cash · No app · 20 seconds</p>
            <hr className={styles.ruleDashed} />

            <p className={styles.hook}>
              Everyone <span className={styles.hookAccent}>wins</span> something
            </p>

            <div className={styles.items}>
              <ReceiptItem label="Today's first stamp" value="Free" accent />
              <ReceiptItem label="Mystery reward" value="Locked" />
              <ReceiptItem label={`${visitWord} to unlock`} value={String(stamps)} />
            </div>

            <hr className={styles.ruleDashed} />
            <div className={styles.total}>
              <span>To join</span>
              <span>£0.00</span>
            </div>
            <hr className={styles.ruleDashed} />

            <div className={styles.stamps}>
              <div
                className={styles.stampRow}
                style={{ "--thermal-slot": `${thermalSlotPx(stamps)}px` } as CSSProperties}
              >
                {Array.from({ length: stamps }, (_, index) => {
                  const earned = index === 0
                  const slotNumber = index + 1

                  return (
                    <span
                      key={slotNumber}
                      className={styles.stampSlot}
                      style={
                        earned
                          ? ({
                              "--stamp-rot":
                                POSTER_STAMP_TILTS[index % POSTER_STAMP_TILTS.length],
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      <StampDot
                        earned={earned}
                        label={`Stamp ${slotNumber} ${earned ? "earned" : "empty"}`}
                        slotNumber={slotNumber}
                        showEmptySlotNumber={!earned}
                        venueName={business}
                      />
                    </span>
                  )
                })}
              </div>
              <p className={styles.caption}>Stamps on your card</p>
            </div>

            <hr className={styles.ruleSolid} />

            <div className={styles.qrZone}>
              <div className={styles.qrField}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
                <img
                  src={qrDataUrl}
                  alt="Nabaperks QR code"
                  width={900}
                  height={900}
                />
              </div>
              <p className={styles.scanLine}>Scan to claim your free stamp</p>
            </div>

            <hr className={styles.ruleSolid} />

            <div className={styles.foot}>
              <span aria-hidden="true" className={styles.barcode} />
              <span className={styles.footBrand}>
                <span aria-hidden="true" className={styles.footMark}>
                  ✱
                </span>
                Powered by nabaperks
              </span>
              <p className={styles.thanks}>*** Thank you ***</p>
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
