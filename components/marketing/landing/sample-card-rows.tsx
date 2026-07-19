import type { ReactNode } from "react"

import { StampGrid } from "@/components/loyalty"

import type { QrMatrix } from "./qr-matrix"
import { VenueQr } from "./venue-qr"

/** Ink-bordered info row — scan beat on the hero, setup facts on the venue card. */
export function CardInfoRow({
  icon,
  eyebrow,
  title,
  framed = true,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  /** QR codes need the white frame; seals and marks can sit flush. */
  framed?: boolean
}) {
  return (
    <div className="flex min-h-[3.75rem] items-center gap-2.5 rounded-lg border-2 border-ink bg-background p-2.5 shadow-xs sm:min-h-[4.25rem] sm:gap-3 sm:p-3">
      {framed ? (
        <span className="grid size-[2.75rem] shrink-0 place-items-center rounded-md border-2 border-ink bg-white p-1 sm:size-[3.25rem]">
          {icon}
        </span>
      ) : (
        <span className="grid size-[2.75rem] shrink-0 place-items-center sm:size-[3.25rem]">
          {icon}
        </span>
      )}
      <div className="grid min-w-0 gap-0.5">
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <p className="text-xs leading-snug font-extrabold text-pretty sm:text-sm">
          {title}
        </p>
      </div>
    </div>
  )
}

export function CardScanRow({
  qrMatrix,
  eyebrow,
  title,
  qrLabel = "Venue QR",
}: {
  qrMatrix: QrMatrix
  eyebrow: string
  title: string
  qrLabel?: string
}) {
  return (
    <CardInfoRow
      icon={<VenueQr matrix={qrMatrix} label={qrLabel} bare />}
      eyebrow={eyebrow}
      title={title}
    />
  )
}

export function CardStampRow({
  current,
  total,
  dates,
  venueInitials,
  showEmptySlotNumbers = false,
  slamIndex = -1,
}: {
  current: number
  total: number
  dates?: string[]
  venueInitials: string
  showEmptySlotNumbers?: boolean
  slamIndex?: number
}) {
  return (
    <div className="min-h-[4.25rem] rounded-lg bg-accent px-2.5 py-2.5 sm:min-h-[5rem] sm:px-3 sm:py-3.5">
      <StampGrid
        current={current}
        total={total}
        dates={dates}
        slamIndex={slamIndex}
        venueInitials={venueInitials}
        showEmptySlotNumbers={showEmptySlotNumbers}
        className="min-h-10 sm:min-h-11"
      />
    </div>
  )
}
