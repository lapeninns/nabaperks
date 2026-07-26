type PosterBrandWordmarkPdf = {
  readonly lead: string
  readonly accent: string
  readonly tail: string
}

/**
 * Canonical lockup segments for PDF drawing, accent on the middle *a*.
 * Segments concatenate to "Nabaperks"; renderers apply casing at draw time
 * rather than carrying a second literal.
 */
export const POSTER_BRAND_WORDMARK_PDF: PosterBrandWordmarkPdf = {
  lead: "Nab",
  accent: "a",
  tail: "perks",
}
