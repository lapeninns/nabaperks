import type { PDFFont } from "pdf-lib"

export function fitSingleLineSize(
  value: string,
  font: PDFFont,
  preferredSize: number,
  minimumSize: number,
  maxWidth: number
): number {
  let size = preferredSize
  while (size > minimumSize && font.widthOfTextAtSize(value, size) > maxWidth) {
    size -= 0.25
  }
  return Math.max(size, minimumSize)
}
