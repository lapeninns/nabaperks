import { describe, expect, it } from "vitest"

import { reconcileCardStampCount } from "@/lib/customer/card"

describe("reconcileCardStampCount", () => {
  it("uses stamp events when membership count lags after onboarding", () => {
    expect(
      reconcileCardStampCount({
        membershipCount: 0,
        stampDateCount: 1,
        total: 3,
      })
    ).toBe(1)
  })

  it("never exceeds the card total", () => {
    expect(
      reconcileCardStampCount({
        membershipCount: 4,
        stampDateCount: 4,
        total: 3,
      })
    ).toBe(3)
  })
})
