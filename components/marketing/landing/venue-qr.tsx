import { QrFrame } from "@/components/loyalty"
import { cn } from "@/lib/utils"

import type { QrMatrix } from "./qr-matrix"

/**
 * Vector venue QR inside the shared scanner-safe frame (always pure white
 * behind the modules). Decorative-plus: the same destination is always offered
 * as a plain link next to it, so the QR itself stays `role="img"`.
 *
 * Pass `bare` when the caller already supplies a white ink frame (e.g. the
 * hero sample card scan row) so modules fill that frame without double chrome.
 */
export function VenueQr({
  matrix,
  label,
  className,
  bare = false,
}: {
  matrix: QrMatrix
  label: string
  className?: string
  bare?: boolean
}) {
  const svg = (
    <svg
      viewBox={`0 0 ${matrix.size} ${matrix.size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn(
        bare ? "block size-full" : "h-auto w-full",
        bare ? className : undefined
      )}
    >
      <path d={matrix.path} fill="currentColor" />
    </svg>
  )

  if (bare) {
    return svg
  }

  return (
    <QrFrame label={label} className={cn("p-3", className)}>
      {svg}
    </QrFrame>
  )
}
