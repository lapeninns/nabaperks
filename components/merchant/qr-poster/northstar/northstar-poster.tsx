import type { CSSProperties } from "react"

import { VenueMark } from "@/components/brand/venue-mark"
import { StampDot } from "@/components/loyalty/stamp-dot"

import styles from "./northstar-poster.module.css"

/**
 * North Star concept — the night-receipt "Everyone wins" poster.
 *
 * Principle: two heroes, one whisper. A promise read at ~2 m (the headline)
 * and a QR scanned at arm's reach (the card), with everything else reduced to
 * quiet connective tissue. The poster IS the loyalty card the customer is about
 * to own — a pure-white card island, first stamp already inked. The endowed
 * stamp is the "one waiting" cue, so there is no separate notification badge.
 *
 * Layout is one deterministic grid (see the module CSS); the card row absorbs
 * all slack, so rhythm holds whatever the stamp count or copy length. "Night"
 * is the `dark` token scope on the sheet — paper/strap surfaces would skin the
 * same markup.
 */

const POSTER_STAMP_TILTS = ["-7deg", "-5deg", "-8deg", "-6deg"] as const

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const

function spell(value: number): string {
  return NUMBER_WORDS[value] ?? String(value)
}

/** Single-site venues repeat the name across both fields — show it once. */
function buildVenueName(businessName: string, locationName: string): string {
  const business = businessName.trim()
  const location = locationName.trim()

  if (!location || location === business) return business
  if (business.includes(location)) return business
  if (location.includes(business)) return location

  return `${business} · ${location}`
}

/** Mystery stated once, mechanism once — the dots carry the count. */
function buildPromise(stampsRequired: number): string {
  if (stampsRequired === 1) {
    return "Your first stamp's already inked — scan to claim it and unlock a mystery reward."
  }

  const remaining = stampsRequired - 1
  const visitVerb = remaining === 1 ? "visit unlocks" : "visits unlock"
  return `You're one stamp in — ${spell(remaining)} more ${visitVerb} a mystery reward.`
}

type NorthStarPosterProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly locationName: string
  readonly stampsRequired: number
}

export function NorthStarPoster({
  qrDataUrl,
  businessName,
  locationName,
  stampsRequired,
}: NorthStarPosterProps) {
  const stamps = Math.max(1, stampsRequired)
  const venueName = buildVenueName(businessName, locationName)
  // The roundel and the stamps carry the brand identity.
  const stampVenue = businessName

  return (
    // `night` surface = the `dark` token scope on the sheet only.
    <article className={`${styles.sheet} dark`}>
      <div className={styles.frame}>
        <header className={styles.identity}>
          <VenueMark name={stampVenue} size={48} />
          <p className={styles.venueName}>{venueName}</p>
        </header>

        <h1 className={styles.hook}>
          Everyone <span className={styles.hookAccent}>wins</span> something.
        </h1>

        <p className={styles.ease}>No app · 20 seconds · No spam</p>

        <section className={styles.cardHero}>
          <span aria-hidden="true" className={styles.cardChip}>
            First stamp free
          </span>
          <p className={styles.caption}>Scan to claim your free stamp</p>
          <div className={styles.qrField}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
            <img
              src={qrDataUrl}
              alt="Nabaperks QR code"
              width={900}
              height={900}
            />
          </div>
          <hr className={styles.cardRule} />
          <div className={styles.stampRow}>
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
                    venueName={stampVenue}
                  />
                </span>
              )
            })}
          </div>
        </section>

        <p className={styles.promise}>{buildPromise(stamps)}</p>

        <footer className={styles.footer}>
          <span className={styles.footerBrand}>
            <span aria-hidden="true" className={styles.footerMark}>
              ✱
            </span>
            Powered by nabaperks
          </span>
          <span>Reward revealed when unlocked</span>
        </footer>
      </div>
    </article>
  )
}
