import type { CSSProperties, ReactNode } from "react"

import { StampDot } from "@/components/loyalty/stamp-dot"
import type { B5ContentBase, B5Geometry } from "@/lib/qr/poster-content-types"

import { PosterWordmark } from "../../poster-wordmark"
import styles from "../table-tent-poster.module.css"

export type TentFaceProps = {
  readonly qrDataUrl: string
  readonly businessName: string
  readonly stampsRequired: number
}

type TentFaceCssProperties = CSSProperties & {
  readonly "--poster-b5-hook-size": string
  readonly "--poster-b5-substantive-size": string
  readonly "--poster-b5-facts-size": string
  readonly "--w-paper": string
  readonly "--w-paper-2": string
  readonly "--w-ink": string
  readonly "--w-ink-soft": string
  readonly "--w-accent": string
  readonly "--w-sun": string
}

export function tentFaceStyle(content: B5ContentBase): TentFaceCssProperties {
  const { geometry, palette, typeTiers } = content
  return {
    gridTemplateRows: `${geometry.identityRowMm}mm ${geometry.mainRowMm}mm ${geometry.lowerOcclusionRowMm}mm`,
    "--poster-b5-hook-size": `${typeTiers.hookPt}pt`,
    "--poster-b5-substantive-size": `${typeTiers.substantivePt}pt`,
    "--poster-b5-facts-size": `${typeTiers.factsPt}pt`,
    "--w-paper": palette.paper,
    "--w-paper-2": palette.paperDeep,
    "--w-ink": palette.ink,
    "--w-ink-soft": palette.inkSoft,
    "--w-accent": palette.accent,
    "--w-sun": palette.sun,
  }
}

export function CompactIdentity({
  businessName,
  className,
}: {
  readonly businessName: string
  readonly className: string
}) {
  return (
    <header className={className}>
      <p
        className={styles.identityVenue}
        data-poster-venue
        data-venue-fit={businessName.trim().length > 44 ? "compact" : undefined}
      >
        {businessName}
      </p>
      <PosterWordmark className={styles.identityBrand} />
    </header>
  )
}

export function CompactStampTrack({
  stamps,
  venueName,
}: {
  readonly stamps: number
  readonly venueName: string
}) {
  return (
    <div className={styles.stampTrack} aria-hidden="true">
      <span className={styles.trackLine} />
      {Array.from({ length: stamps }, (_, index) => {
        const offered = index === 0
        const slotNumber = index + 1
        return (
          <span key={slotNumber} className={styles.stampSlot}>
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
              venueName={venueName}
              className={offered ? styles.offeredStamp : undefined}
            />
          </span>
        )
      })}
    </div>
  )
}

export function TableTentSheet({
  top,
  bottom,
  geometry,
}: {
  readonly top: ReactNode
  readonly bottom: ReactNode
  readonly geometry: B5Geometry
}) {
  const faceHeight = `${geometry.faceHeightMm}mm`
  return (
    <article
      className={styles.sheet}
      style={{
        width: `${geometry.sheetWidthMm}mm`,
        height: `${geometry.sheetHeightMm}mm`,
        minHeight: `${geometry.sheetHeightMm}mm`,
        maxHeight: `${geometry.sheetHeightMm}mm`,
        gridTemplateRows: `${faceHeight} ${faceHeight}`,
      }}
    >
      <div className={styles.faceTop} style={{ height: faceHeight }}>
        {top}
      </div>
      <div
        aria-hidden="true"
        className={styles.foldGuide}
        style={{ top: `calc(${faceHeight} - 0.5pt)` }}
      />
      <div className={styles.faceBottom} style={{ height: faceHeight }}>
        {bottom}
      </div>
    </article>
  )
}
