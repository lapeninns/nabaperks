import { describe, expect, it } from "vitest"

import { safeNextPath, walletLoginHref } from "@/lib/navigation/safe-next-path"

describe("safeNextPath", () => {
  it("allows in-app absolute paths", () => {
    expect(safeNextPath("/card/membership-1")).toBe("/card/membership-1")
    expect(safeNextPath("/reward/reward-1?redeemed=1")).toBe(
      "/reward/reward-1?redeemed=1"
    )
  })

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNextPath("//evil.test/phish")).toBe("/wallet")
    expect(safeNextPath("https://evil.test")).toBe("/wallet")
    expect(safeNextPath("http://evil.test")).toBe("/wallet")
  })

  it("rejects backslash and non-path inputs", () => {
    expect(safeNextPath("/\\evil.test")).toBe("/wallet")
    expect(safeNextPath("javascript:alert(1)")).toBe("/wallet")
    expect(safeNextPath("card/1")).toBe("/wallet")
    expect(safeNextPath("")).toBe("/wallet")
  })
})

describe("walletLoginHref", () => {
  it("builds an encoded wallet login link from a safe path", () => {
    expect(walletLoginHref("/card/membership-1")).toBe(
      "/wallet/login?next=%2Fcard%2Fmembership-1"
    )
  })

  it("collapses an unsafe path to the wallet home", () => {
    expect(walletLoginHref("//evil.test")).toBe("/wallet/login?next=%2Fwallet")
  })
})
