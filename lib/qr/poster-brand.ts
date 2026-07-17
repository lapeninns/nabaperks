/**
 * Print wordmark for posters. Readable brand is "Nab a Perks" — middle *a*
 * carries the Wet Ink accent. CSS `text-transform: uppercase` on some rails
 * turns this into "NAB A PERKS" without collapsing the words.
 */
export const POSTER_BRAND_WORDMARK = "Nab a Perks"

/** Uppercase identity-rail segments for PDF drawing (accent on middle A). */
export const POSTER_BRAND_WORDMARK_PDF = {
  lead: "NAB ",
  accent: "A",
  tail: " PERKS",
} as const
