import type { ReactNode } from "react"

import { StampDot } from "@/components/loyalty/stamp-dot"

import styles from "./a4-poster.module.css"
import type { PosterCopy } from "./poster-copy"
import { PosterWordmark } from "./poster-wordmark"

/** The giant promise, with the emotional anchor word in accent red. */
export function Headline({
  className,
  copy,
}: {
  readonly className: string
  readonly copy: PosterCopy
}) {
  const { headline } = copy

  // h2, not h1: on the preview document the page heading is the chrome's h1
  // (poster-preview-chrome.tsx); a second h1 here doubled the document
  // outline. Print output is unaffected — the classes drive the type.
  return (
    <h2 className={className}>
      {headline.beforeAccent}
      <span className={styles.hookWin}>{headline.accent}</span>
      {headline.afterAccent}
    </h2>
  )
}

/** The friction-killer line, styled as an understated disclaimer. */
export function FrictionBand({ text }: { readonly text: string }) {
  return <p className={styles.frictionBand}>{text}</p>
}

export function PosterIdentity({ venue }: { readonly venue: string }) {
  return (
    <header className={styles.identityRail}>
      <span
        data-poster-venue
        data-venue-fit={venue.trim().length > 44 ? "compact" : undefined}
      >
        {venue}
      </span>
      <PosterWordmark className={styles.identityBrand} />
    </header>
  )
}

export function QrBlock({
  qrDataUrl,
  title,
  holderClassName,
  outerMm,
  footer,
}: {
  readonly qrDataUrl: string
  readonly title?: ReactNode
  readonly holderClassName: string
  readonly outerMm: number
  readonly footer?: ReactNode
}) {
  return (
    <figure className={styles.qrBlock}>
      {title ? <figcaption>{title}</figcaption> : null}
      <div
        className={holderClassName}
        style={{ width: `${outerMm}mm`, height: `${outerMm}mm` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
        <img src={qrDataUrl} alt="Nabaperks QR code" width={900} height={900} />
      </div>
      {footer}
    </figure>
  )
}

/**
 * Under the QR: a red accent line (the win→scan visual circuit), the
 * endowed-progress stamp row, and the progress line. Stamps use the shared
 * Wet Ink StampDot so posters match the live loyalty card.
 */
export function QrProgress({ copy }: { readonly copy: PosterCopy }) {
  return (
    <div className={styles.qrProgress}>
      <span
        aria-hidden="true"
        className={styles.qrAccentLine}
        data-solo={copy.stampsRequired === 1 ? "true" : undefined}
      />
      <span aria-hidden="true" className={styles.progressStamps}>
        {Array.from({ length: copy.stampsRequired }, (_, index) => {
          const offered = index === 0
          const slotNumber = index + 1

          return (
            <span key={slotNumber} className={styles.progressStampSlot}>
              <StampDot
                earned={false}
                compact
                label={
                  offered
                    ? "Stamp one starts after joining"
                    : `Stamp ${slotNumber} empty`
                }
                slotNumber={slotNumber}
                showEmptySlotNumber
                venueName={copy.businessName}
                className={offered ? styles.offeredStamp : undefined}
              />
            </span>
          )
        })}
      </span>
      <p className={styles.attainability}>{copy.progress}</p>
    </div>
  )
}

/** The ticket perforation — punch circles pulled inward off the no-print band. */
export function TearLine() {
  return (
    <div aria-hidden="true" className={styles.tearLine}>
      <span />
      <span />
      <i />
    </div>
  )
}

export function PosterFooter({ copy }: { readonly copy: PosterCopy }) {
  return (
    <footer className={styles.posterFooter}>
      <span>{copy.reassurance}</span>
    </footer>
  )
}
