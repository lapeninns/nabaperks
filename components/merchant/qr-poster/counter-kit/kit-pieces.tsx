import type { CSSProperties, ReactNode } from "react"

import type { A4ContentBase } from "@/lib/qr/poster-content-types"
import type { FrictionTriple } from "@/lib/qr/poster-kit-content-types"

import styles from "./kit-pieces.module.css"

/**
 * Shared pieces for the counter-kit posters (Nº 06–15). Hosts pick the
 * colourway with --kit-* custom properties; copy always arrives resolved.
 */

type KitTypeTiers = {
  readonly typeTiers: A4ContentBase["typeTiers"]
  readonly geometry: A4ContentBase["geometry"]
}

type KitSheetCssProperties = CSSProperties & {
  readonly "--poster-a4-hook-size": string
  readonly "--poster-a4-substantive-size": string
  readonly "--poster-a4-facts-size": string
  readonly "--poster-frame-safe-margin": string
}

/** Fixed-A4 sheet style: print geometry, type tiers and frame-safe inset. */
export function kitSheetStyle(content: KitTypeTiers): KitSheetCssProperties {
  return {
    "--poster-a4-hook-size": `${content.typeTiers.hookPt}pt`,
    "--poster-a4-substantive-size": `${content.typeTiers.substantivePt}pt`,
    "--poster-a4-facts-size": `${content.typeTiers.factsPt}pt`,
    "--poster-frame-safe-margin": `${content.geometry.safeMarginMm}mm`,
    width: `${content.geometry.sheetWidthMm}mm`,
    height: `${content.geometry.sheetHeightMm}mm`,
    minHeight: `${content.geometry.sheetHeightMm}mm`,
    maxHeight: `${content.geometry.sheetHeightMm}mm`,
  }
}

export function kitSheetClass(hostClassName: string): string {
  return `${styles.sheet} ${hostClassName}`
}

/** Venue fit tier — larger names step down instead of ellipsising. */
export function kitVenueFit(venue: string): "mid" | "compact" | undefined {
  const length = venue.trim().length
  if (length > 44) return "compact"
  if (length > 26) return "mid"
  return undefined
}

export function KitVenueName({ venue }: { readonly venue: string }) {
  return (
    <span
      className={styles.venueName}
      data-poster-venue
      data-venue-fit={kitVenueFit(venue)}
    >
      {venue}
    </span>
  )
}

export function KitMemberTag({
  tag,
  variant,
}: {
  readonly tag: string
  readonly variant: "pill" | "outline" | "plain"
}) {
  return (
    <span className={styles.memberTag} data-variant={variant}>
      {tag}
    </span>
  )
}

/** The rotated vermillion ✱ disc, or the bare ✱ glyph on duotone strips. */
export function KitBrandMark({
  shape,
}: {
  readonly shape: "roundel" | "glyph"
}) {
  return (
    <span
      aria-hidden="true"
      className={shape === "roundel" ? styles.brandRoundel : styles.brandMark}
    >
      ✱
    </span>
  )
}

export function KitQrPanel({
  qrDataUrl,
  caption,
  outerMm,
  className,
}: {
  readonly qrDataUrl: string
  readonly caption: string
  readonly outerMm: number
  readonly className?: string
}) {
  return (
    <figure
      className={className ? `${styles.qrPanel} ${className}` : styles.qrPanel}
      style={{ width: `${outerMm}mm` }}
    >
      <div
        className={styles.qrBox}
        style={{ width: `${outerMm}mm`, height: `${outerMm}mm` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR is generated server-side for print */}
        <img src={qrDataUrl} alt="Nabaperks QR code" width={900} height={900} />
      </div>
      <figcaption className={styles.qrCaption}>{caption}</figcaption>
    </figure>
  )
}

export function KitFrictionList({
  lines,
  marked = false,
}: {
  readonly lines: FrictionTriple
  readonly marked?: boolean
}) {
  return (
    <ul className={styles.friction}>
      {lines.map((line) => (
        <li key={line} className={styles.frictionRow}>
          {marked ? (
            <span aria-hidden="true" className={styles.frictionMark}>
              ✱
            </span>
          ) : null}
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

/** The primer/seal issued-by block: label rail, venue name, ink signature. */
export function KitLedgerVenueBlock({
  issuerLabel,
  memberTag,
  venue,
  signature,
}: {
  readonly issuerLabel: string
  readonly memberTag: string
  readonly venue: string
  readonly signature: string
}) {
  return (
    <div className={styles.ledgerVenue}>
      <div className={styles.ledgerVenueRail}>
        <span>{issuerLabel}</span>
        <span>{memberTag}</span>
      </div>
      <KitVenueName venue={venue} />
      <span className={styles.ledgerSignature}>
        {signature} <span aria-hidden="true">✱</span>
      </span>
    </div>
  )
}

export function KitFooter({
  reassurance,
  className,
}: {
  readonly reassurance: string
  readonly className?: string
}) {
  return (
    <footer
      className={className ? `${styles.footer} ${className}` : styles.footer}
    >
      <span>{reassurance}</span>
    </footer>
  )
}

export function KitMasthead({
  className,
  lead,
  edition,
}: {
  readonly className: string
  readonly lead: ReactNode
  readonly edition: ReactNode
}) {
  return (
    <header className={className}>
      {lead}
      {edition}
    </header>
  )
}
