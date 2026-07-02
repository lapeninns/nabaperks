import type { ReactNode } from "react"

import { StampGrid } from "@/components/loyalty"

import { VenueQr, type QrMatrix } from "./venue-qr"

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
    <div className="flex min-h-[4.25rem] items-center gap-3 rounded-lg border-2 border-ink bg-background p-3 shadow-xs">
      {framed ? (
        <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-md border-2 border-ink bg-white p-1">
          {icon}
        </span>
      ) : (
        <span className="grid size-[3.25rem] shrink-0 place-items-center">
          {icon}
        </span>
      )}
      <div className="min-w-0 grid gap-0.5">
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <p className="text-sm leading-snug font-extrabold text-pretty">{title}</p>
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
      icon={<VenueQr matrix={qrMatrix} label={qrLabel} />}
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
    <div className="min-h-[5rem] rounded-lg bg-accent px-3 py-3.5">
      <StampGrid
        current={current}
        total={total}
        dates={dates}
        slamIndex={slamIndex}
        venueInitials={venueInitials}
        showEmptySlotNumbers={showEmptySlotNumbers}
        className="min-h-11"
      />
    </div>
  )
}
