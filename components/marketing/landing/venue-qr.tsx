import { cn } from "@/lib/utils"

/**
 * A real QR module matrix, computed once on the server (via `qrcode`) and passed
 * down so the same code renders crisply in the hero card and the reward reveal
 * without shipping the QR library to the client. `bits` is row-major
 * (`y * size + x`), `true` for a dark module.
 */
export type QrMatrix = {
  size: number
  bits: boolean[]
}

/**
 * Venue QR — the permanent counter code, drawn as pure inline SVG so it stays
 * sharp at any size and themes with no raster asset. QR modules are always the
 * fixed QR ink on a pure-white frame (DESIGN.md: the QR is a functional graphic,
 * never decorated), so the colour here is intentionally not a paper/ink token.
 */
export function VenueQr({
  matrix,
  className,
  label = "Venue QR code",
}: {
  matrix: QrMatrix
  className?: string
  label?: string
}) {
  const { size, bits } = matrix

  let path = ""
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (bits[y * size + x]) {
        path += `M${x} ${y}h1v1h-1z`
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={cn("block size-full", className)}
    >
      <path d={path} fill="#111111" />
    </svg>
  )
}
