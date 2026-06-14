import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

describe("customer flow Wet Ink redesign", () => {
  it("routes customer pages through the dedicated Wet Ink flow system", () => {
    const flowSystemPath = "components/customer/customer-flow-system.tsx"

    expect(existsSync(flowSystemPath)).toBe(true)

    const flowSystem = read(flowSystemPath)
    const expectedExports = [
      "CustomerFlowShell",
      "CustomerReceipt",
      "CustomerStampCard",
      "CustomerRewardSeal",
      "CustomerActionNote",
    ]

    for (const exportName of expectedExports) {
      expect(flowSystem).toContain(`function ${exportName}`)
    }

    // The landing route renders Wet Ink chrome directly.
    expect(read("app/m/[merchantSlug]/page.tsx")).toContain(
      "customer-flow-system"
    )

    // The join route is a thin wrapper over the join wizard; the card / stamp /
    // reward routes are thin wrappers over the shared experience layer. Both
    // render the Wet Ink flow system.
    expect(read("app/m/[merchantSlug]/join/page.tsx")).toContain("join-wizard")
    for (const routePath of [
      "app/card/[membershipId]/page.tsx",
      "app/card/[membershipId]/stamp/page.tsx",
      "app/reward/[rewardId]/page.tsx",
    ]) {
      expect(read(routePath), routePath).toContain("customer-card-experience")
    }
    for (const componentPath of [
      "components/customer/customer-card-experience.tsx",
      "components/customer/join-wizard.tsx",
    ]) {
      expect(read(componentPath), componentPath).toContain("customer-flow-system")
    }
  })

  it("uses value-first Wet Ink copy and physical loyalty motifs", () => {
    const flowSystem = read("components/customer/customer-flow-system.tsx")
    const joinPage = read("app/m/[merchantSlug]/join/page.tsx")
    const experience = read(
      "components/customer/customer-card-experience.tsx"
    )
    const copy = read("lib/customer/experience/copy.ts")

    expect(read("DESIGN.md")).toContain("Your first stamp is waiting.")
    // The value-first hero headline lives in the experience copy. The QR-scan
    // welcome stays neutral ("Save your stamp card") because it is shown to
    // logged-out returning members too; "first stamp" copy is reserved for the
    // merchant preview and the terms step, where the new-user context is known.
    expect(copy).toContain("Save your stamp card")
    expect(joinPage).not.toContain(
      "Join {context.merchant.business_name} Rewards"
    )

    for (const motif of [
      "receipt-edge",
      "w-rule",
      "-rotate-6",
      "CARD Nº",
      "ONE STAMP PER BUSINESS DAY",
    ]) {
      expect(flowSystem, motif).toContain(motif)
    }

    expect(experience).toContain("Something's under there.")
    expect(copy).toContain("Stamp it here")
    expect(experience).toContain("Give it a day to breathe")
  })
})
