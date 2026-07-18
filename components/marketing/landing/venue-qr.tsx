import { QrFrame } from "@/components/loyalty"
import { cn } from "@/lib/utils"

import type { QrMatrix } from "./qr-matrix"

/**
 * Vector venue QR inside the shared scanner-safe frame (always pure white
 * behind the modules). Decorative-plus: the same destination is always offered
 * as a plain link next to it, so the QR itself stays `role="img"`.
 */
export function VenueQr({
  matrix,
  label,
  className,
}: {
  matrix: QrMatrix
  label: string
  className?: string
}) {
  return (
    <QrFrame label={label} className={cn("p-3", className)}>
      <svg
        viewBox={`0 0 ${matrix.size} ${matrix.size}`}
        role="img"
        aria-label={label}
        shapeRendering="crispEdges"
        className="h-auto w-full"
      >
        <path d={matrix.path} fill="currentColor" />
      </svg>
    </QrFrame>
  )
}
