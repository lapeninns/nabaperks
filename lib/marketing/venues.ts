/**
 * The real venues already stamping with Nabaperks, used as honest, quote-free
 * social proof on the marketing landing page. This is the single source of
 * truth for that list — the landing page renders it verbatim and never invents
 * quotes, scores, or venues beyond it.
 *
 * `initials` is the two-letter rubber-stamp roundel text: drop a leading "The"
 * and "of", then take the first letter of the next two significant words (or
 * the first two letters when a single word remains).
 */
export type StampingVenue = {
  /** Real trading name, exactly as supplied. */
  readonly name: string
  /** Real UK postcode, exactly as supplied. */
  readonly postcode: string
  /** Two-letter uppercase roundel mark for `VenueMark`. */
  readonly initials: string
}

export const STAMPING_VENUES: readonly StampingVenue[] = [
  { name: "The Prince of Wales", postcode: "MK43 8PE", initials: "PW" },
  { name: "Old School House", postcode: "MK11 1JA", initials: "OS" },
  { name: "Barley Mow", postcode: "PE29 1XU", initials: "BM" },
  { name: "The Queen Elizabeth", postcode: "PE30 4EL", initials: "QE" },
  { name: "The Railway", postcode: "PE7 1UF", initials: "RA" },
  { name: "The Bell", postcode: "PE28 5UY", initials: "BE" },
  { name: "Old Crown", postcode: "CB3 0QD", initials: "OC" },
  { name: "The Corner House", postcode: "CB5 8JE", initials: "CH" },
  { name: "White Horse", postcode: "CB25 9HP", initials: "WH" },
]
