"use client"

import { useLayoutEffect, useRef, useState } from "react"

import {
  PosterSheet,
  type PosterSheetProps,
} from "@/components/merchant/qr-poster/a4-poster"
import { isQrPosterTableTent } from "@/lib/qr/poster-templates"
import { cn } from "@/lib/utils"

export function PosterThumbnail({
  previewLabel,
  ...props
}: PosterSheetProps & { readonly previewLabel: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.24)
  const isTableTent = isQrPosterTableTent(props.template)

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
  }, [isTableTent])

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={previewLabel}
      className={cn(
        "relative w-full overflow-hidden bg-paper shadow-sm",
        isTableTent ? "aspect-[176/250]" : "aspect-[210/297]"
      )}
    >
      <div
        ref={sheetRef}
        aria-hidden="true"
        className={cn(
          "absolute top-0 left-1/2 origin-top",
          isTableTent ? "h-[250mm] w-[176mm]" : "h-[297mm] w-[210mm]"
        )}
        style={{
          transform: `translateX(-50%) scale(${scale})`,
        }}
      >
        <PosterSheet {...props} />
      </div>
    </div>
  )
}
