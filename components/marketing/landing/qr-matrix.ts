import QRCode from "qrcode"

export type QrMatrix = {
  readonly size: number
  readonly path: string
}

/**
 * Build a QR module matrix as a single SVG path (server-side, vector — no
 * raster round-trip). Rendered by `VenueQr` on pure white per the QR rule in
 * DESIGN.md.
 */
export function buildQrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" })
  const size = modules.size
  let path = ""

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) {
        path += `M${col} ${row}h1v1h-1z`
      }
    }
  }

  return { size, path }
}
