/**
 * Print wordmark for posters. Readable brand is "Nab a Perks" — middle *a*
 * carries the Wet Ink accent. CSS `text-transform: uppercase` on some rails
 * turns this into "NAB A PERKS" without collapsing the words.
 */
export const POSTER_BRAND_WORDMARK = "Nab a Perks"

type PosterBrandWordmarkPdf = {
  readonly lead: string
  readonly accent: string
  readonly tail: string
}

/** Uppercase identity-rail segments for PDF drawing (accent on middle A). */
export const POSTER_BRAND_WORDMARK_PDF: PosterBrandWordmarkPdf = {
  lead: "NAB ",
  accent: "A",
  tail: " PERKS",
}
