import { describe, expect, it } from "vitest"

import { safeNextPath, customerLoginHref } from "@/lib/navigation/safe-next-path"

describe("safeNextPath", () => {
  it("allows in-app absolute paths", () => {
    expect(safeNextPath("/card/membership-1")).toBe("/card/membership-1")
    expect(safeNextPath("/reward/reward-1?redeemed=1")).toBe(
      "/reward/reward-1?redeemed=1"
    )
  })

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.test/phish")).toBe("/home")
    expect(safeNextPath("https://evil.test")).toBe("/home")
    expect(safeNextPath("http://evil.test")).toBe("/home")
  })

  it("rejects backslash and non-path inputs", () => {
    expect(safeNextPath("/\\evil.test")).toBe("/home")
    expect(safeNextPath("javascript:alert(1)")).toBe("/home")
    expect(safeNextPath("card/1")).toBe("/home")
    expect(safeNextPath("")).toBe("/home")
  })

  it("rejects the customer login page as a next target", () => {
    expect(safeNextPath("/home/login")).toBe("/home")
    expect(safeNextPath("/home/login?next=%2Fhome%2Fprofile")).toBe("/home")
  })

  it("rejects the customer session reset page as a next target", () => {
    expect(safeNextPath("/home/session/reset")).toBe("/home")
    expect(safeNextPath("/home/session/reset?next=%2Fhome%2Fprofile")).toBe(
      "/home"
    )
  })
})

describe("customerLoginHref", () => {
  it("builds an encoded customer login link from a safe path", () => {
    expect(customerLoginHref("/card/membership-1")).toBe(
      "/home/login?next=%2Fcard%2Fmembership-1"
    )
  })

  it("collapses an unsafe path to the customer home", () => {
    expect(customerLoginHref("//evil.test")).toBe("/home/login?next=%2Fhome")
  })
})
