import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

describe("customer-flow demo script helpers", () => {
  it("normalizes the reset customer phone into E.164", async () => {
    const { normalizeDemoPhone } = await import(
      "../../scripts/customer-flow-demo.mjs"
    )

    expect(normalizeDemoPhone("07467 586751")).toBe("+447467586751")
    expect(normalizeDemoPhone("+44 7467 586751")).toBe("+447467586751")
  })

  it("uses the same customer phone HMAC contract as the app", async () => {
    const { demoPhoneHmac } = await import(
      "../../scripts/customer-flow-demo.mjs"
    )
    const expected = createHmac("sha256", "demo-secret")
      .update("+447467586751")
      .digest("hex")

    expect(demoPhoneHmac("+447467586751", "demo-secret")).toBe(expected)
  })

  it("parses advance arguments with a bounded stamp count", async () => {
    const { parseCustomerFlowArgs } = await import(
      "../../scripts/customer-flow-demo.mjs"
    )

    expect(
      parseCustomerFlowArgs(["advance", "--phone", "07467586751", "--stamps", "2"])
    ).toEqual({
      command: "advance",
      phone: "+447467586751",
      stamps: 2,
    })
    expect(() =>
      parseCustomerFlowArgs(["advance", "--phone", "07467586751", "--stamps", "3"])
    ).toThrow("between 0 and 2")
  })
})
