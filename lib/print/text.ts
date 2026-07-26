/**
 * Font metrics injected by the caller so this layer stays free of any render
 * dependency. The PDF path supplies pdf-lib metrics, which are ground truth —
 * both paths lay out from the same numbers rather than measuring separately.
 */
export type TextMetrics = {
  readonly widthPt: (text: string, sizePt: number) => number
  readonly normalise: (text: string) => string
}

export const PT_PER_MM = 72 / 25.4

export function ptToMm(valuePt: number): number {
  return valuePt / PT_PER_MM
}

export function mmToPt(valueMm: number): number {
  return valueMm * PT_PER_MM
}

/**
 * Greedy word wrap. Mirrors drawWrappedText in poster-pdf-style so a measured
 * line count always matches what the painter will actually draw.
 */
export function wrapLines(
  text: string,
  metrics: TextMetrics,
  sizePt: number,
  maxWidthPt: number
): readonly string[] {
  const words = metrics.normalise(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  for (const word of words) {
    const index = lines.length - 1
    const current = lines[index]
    const candidate = current ? `${current} ${word}` : word
    if (current && metrics.widthPt(candidate, sizePt) <= maxWidthPt) {
      lines[index] = candidate
    } else {
      lines.push(word)
    }
  }
  return lines
}

/** Height of a wrapped block in millimetres, at the given leading multiple. */
export function blockHeightMm(
  lineCount: number,
  sizePt: number,
  leading: number
): number {
  return ptToMm(lineCount * sizePt * leading)
}
