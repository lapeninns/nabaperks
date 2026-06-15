import { describe, expect, it } from "vitest"

import { formatDateOfBirth } from "@/lib/customer/format"

describe("formatDateOfBirth", () => {
  it("renders a bare ISO date as a human British date", () => {
    expect(formatDateOfBirth("1990-01-01")).toBe("1 Jan 1990")
  })

  it("keeps the calendar date stable regardless of time zone", () => {
    // A summer date must not slip a day when read as a UK instant.
    expect(formatDateOfBirth("1988-06-30")).toBe("30 Jun 1988")
  })
})
