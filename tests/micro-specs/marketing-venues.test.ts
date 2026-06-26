import { describe, expect, it } from "vitest"

import { STAMPING_VENUES } from "@/lib/marketing/venues"

/**
 * The supplied, real venue + postcode list is the ONLY social proof allowed on
 * the landing page. Any drift from this exact list is a fabrication, so the
 * data module is pinned byte-for-byte here. No quotes, scores, or invented
 * venues may ever join it.
 */
const SUPPLIED: ReadonlyArray<{ name: string; postcode: string }> = [
  { name: "The Prince of Wales", postcode: "MK43 8PE" },
  { name: "Old School House", postcode: "MK11 1JA" },
  { name: "Barley Mow", postcode: "PE29 1XU" },
  { name: "The Queen Elizabeth", postcode: "PE30 4EL" },
  { name: "The Railway", postcode: "PE7 1UF" },
  { name: "The Bell", postcode: "PE28 5UY" },
  { name: "Old Crown", postcode: "CB3 0QD" },
  { name: "The Corner House", postcode: "CB5 8JE" },
  { name: "White Horse", postcode: "CB25 9HP" },
]

// Standard UK postcode shape: outward code + single space + inward code.
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/

describe("supplied stamping-venue list", () => {
  it("contains exactly the supplied venues, in order, with exact postcodes", () => {
    expect(
      STAMPING_VENUES.map((venue) => ({
        name: venue.name,
        postcode: venue.postcode,
      }))
    ).toEqual(SUPPLIED)
  })

  it("uses well-formed, unique UK postcodes", () => {
    for (const venue of STAMPING_VENUES) {
      expect(venue.postcode, `${venue.name} postcode`).toMatch(UK_POSTCODE)
    }
    const postcodes = STAMPING_VENUES.map((venue) => venue.postcode)
    expect(new Set(postcodes).size).toBe(postcodes.length)
  })

  it("gives each venue a two-letter uppercase roundel initial", () => {
    for (const venue of STAMPING_VENUES) {
      expect(venue.initials, `${venue.name} initials`).toMatch(/^[A-Z]{2}$/)
    }
  })

  it("invents no venue beyond the supplied list", () => {
    expect(STAMPING_VENUES).toHaveLength(SUPPLIED.length)
    const suppliedNames = new Set(SUPPLIED.map((venue) => venue.name))
    for (const venue of STAMPING_VENUES) {
      expect(suppliedNames.has(venue.name), `${venue.name} is supplied`).toBe(
        true
      )
    }
  })
})
