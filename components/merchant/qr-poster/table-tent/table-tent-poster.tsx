import type { CSSProperties } from "react"

import { StampDot } from "@/components/loyalty/stamp-dot"

import { getPosterCopy, POSTER_REASSURANCE } from "../poster-copy"

import styles from "./table-tent-poster.module.css"

/**
 * Table tent — Wet Ink adaptation of the print-studio redesign.
 *
 * Physics:
 * - ISO B5 portrait 176×250 mm, two equal faces 176×125 mm.
 * - Centre = mountain-fold peak. Fold top half down.
 * - Face A (top of sheet) rotated 180° so content tops meet at the peak.
 *
 * Face structure (from the downloaded redesign, re-skinned in Wet Ink):
 * - Ink brand bar → stacked VISIT / STAMP / UNLOCK promise → vermillion scan.
 * - Two heroes: spoken stack + QR. Whisper footer on the table edge.
 */

const POSTER_STAMP_TILTS = ["-7deg", "-5deg", "-8deg", "-6deg"] as const

type TableTentPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

function padStamp(slot: number): string {
  return String(slot).padStart(2, "0")
}

function venueLine(businessName: string): { primary: string; rest: string } {
  const trimmed = businessName.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return { primary: trimmed, rest: "" }
  const mid = Math.max(1, parts.length - 1)
  return {
    primary: parts.slice(0, mid).join(" "),
    rest: parts.slice(mid).join(" "),
  }
}

function TentFace({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TableTentPosterProps) {
  const copy = getPosterCopy({ businessName, stampsRequired }, "editorial")
  const stamps = Math.max(1, copy.stampsRequired)
  const venue = venueLine(copy.eyebrow)
  const edition = padStamp(stamps)

  return (
    <section className={styles.face}>
      <header className={styles.brandBar}>
        <div className={styles.wordmark}>
          <span aria-hidden="true" className={styles.wordmarkMark}>
            ✱
          </span>
          <span>
            NABA<span className={styles.wordmarkAccent}>/PERKS</span>
          </span>
        </div>
        <div className={styles.edition}>
          <span>Table rewards</span>
          <b>No. {edition}</b>
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.promise}>
          <p className={styles.venueLine}>
            <span>{venue.primary}</span>
            {venue.rest ? ` / ${venue.rest}` : null}
          </p>

          <h2 className={styles.stack}>
            <span>Visit.</span>
            <span>Stamp.</span>
            <span className={styles.unlock}>Unlock.</span>
          </h2>

          <div className={styles.rewardRow}>
            <div className={styles.stampTrack} aria-hidden="true">
              <span className={styles.trackLine} />
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
                              POSTER_STAMP_TILTS[
                                index % POSTER_STAMP_TILTS.length
                              ],
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <StampDot
                      earned={earned}
                      compact
                      label={`Stamp ${slotNumber} ${earned ? "earned" : "empty"}`}
                      slotNumber={slotNumber}
                      showEmptySlotNumber={!earned}
                      venueName={copy.eyebrow}
                    />
                  </span>
                )
              })}
            </div>
            <p className={styles.rewardCopy}>
              {stamps === 1
                ? "One visit unlocks your mystery reward."
                : `${stamps} visits unlock a mystery reward.`}
            </p>
          </div>
        </div>

        <aside className={styles.scan}>
          <div className={styles.scanHeading}>
            <span>01 / Start here</span>
            <span aria-hidden="true" className={styles.scanArrow}>
              →
            </span>
          </div>

          <div className={styles.qrWrap}>
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
              Point your camera.
              <br />
              Get stamped.
            </p>
            <span className={styles.noApp}>{copy.frictionLine}</span>
          </div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <span>One stamp per day</span>
        <span className={styles.footerCentre}>
          <span aria-hidden="true" className={styles.footerMark}>
            ✱
          </span>
          Rewards for regulars
        </span>
        <span className={styles.footerEnd}>{POSTER_REASSURANCE}</span>
      </footer>
    </section>
  )
}

export function TableTentPoster({
  qrDataUrl,
  businessName,
  stampsRequired,
}: TableTentPosterProps) {
  const faceProps = { qrDataUrl, businessName, stampsRequired }

  return (
    <article className={styles.sheet}>
      <div className={styles.faceTop}>
        <TentFace {...faceProps} />
      </div>
      <div aria-hidden="true" className={styles.foldGuide}>
        <span>Fold to peak</span>
      </div>
      <div className={styles.faceBottom}>
        <TentFace {...faceProps} />
      </div>
    </article>
  )
}
