import QRCode from "qrcode"

import type { QrMatrix } from "./venue-qr"

/**
 * Server-side QR matrix builder shared by the marketing pages: the matrix is
 * computed once per page render so the `qrcode` library never ships to the
 * browser. Deliberately NOT exported from the landing barrel — pages import it
 * directly, keeping it out of any client component's module graph.
 */
export function buildQrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" })
  const { size, data } = qr.modules
  const bits = Array.from(
    { length: size * size },
    (_, index) => data[index] === 1
  )
  return { size, bits }
}
