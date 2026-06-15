import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("customer home dashboard structure", () => {
  it("wires the home page to dashboard components and the richer empty state", () => {
    const homePage = readProjectFile("app/home/(authed)/page.tsx")
    const emptyState = readProjectFile(
      "components/customer/home-empty-state.tsx"
    )

    expect(homePage).toContain("getCustomerHomeDashboard")
    expect(homePage).toContain("HomeSummaryStrip")
    expect(homePage).toContain("HomeActivitySnippet")
    expect(homePage).toContain("HomeRedeemBanner")
    expect(homePage).toContain("HomeCardTile")
    expect(homePage).not.toContain("ProgressTrack")

    expect(readProjectFile("components/customer/home-card-tile.tsx")).toContain(
      "StampGrid"
    )
    expect(emptyState).toContain("JOIN_WELCOME_HOW_IT_WORKS")
    expect(emptyState).toContain('href="/scan"')
    expect(emptyState).toContain("Scan venue QR")
  })

  it("wires scan into the fixed customer navigation", () => {
    const tabBar = readProjectFile("components/layout/customer-tab-bar.tsx")

    expect(tabBar).toContain('href: "/scan"')
    expect(tabBar).toContain('label: "Scan"')
    expect(tabBar).toContain("QrCode01Icon")
    expect(tabBar).toContain('href === "/scan"')
  })
})
