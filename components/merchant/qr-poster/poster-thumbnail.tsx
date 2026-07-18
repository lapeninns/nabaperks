"use client"

import { useLayoutEffect, useRef, useState } from "react"

import {
  PosterSheet,
  type PosterSheetProps,
} from "@/components/merchant/qr-poster/a4-poster"

export function PosterThumbnail({
  previewLabel,
  ...props
}: PosterSheetProps & { readonly previewLabel: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.24)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const sheet = sheetRef.current
    if (!frame || !sheet) return

    const fitSheet = () => {
      const frameWidth = frame.clientWidth
      const sheetWidth = sheet.offsetWidth
      if (frameWidth <= 0 || sheetWidth <= 0) return

      setScale(frameWidth / sheetWidth)
    }

    fitSheet()
    const observer = new ResizeObserver(fitSheet)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={previewLabel}
      className="relative aspect-[210/297] w-full overflow-hidden bg-paper shadow-sm"
    >
      <div
        ref={sheetRef}
        aria-hidden="true"
        className="absolute top-0 left-1/2 h-[297mm] w-[210mm] origin-top"
        style={{
          transform: `translateX(-50%) scale(${scale})`,
        }}
      >
        <PosterSheet {...props} />
      </div>
    </div>
  )
}
