import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Cross-surface copy consistency from the friction audit (#19, #29). Aligned in
 * place rather than via a shared copy.ts constant, because the source-structure
 * tests pin literal strings (e.g. "Stamp added.") inside each component file.
 */
describe("customer copy consistency", () => {
  it("uses one post-stamp confirmation body across the collector and the refreshed card (#19)", () => {
    const collector = readProjectFile("components/customer/stamp-collector.tsx")
    const card = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    expect(collector).toContain("Your progress is saved.")
    expect(card).toContain("Your progress is saved.")
    // The divergent phrasing is gone.
    expect(card).not.toContain("Your progress has been updated.")
  })

  it("aligns the entry acquisition CTA onto the shared 'Get ... stamp' family (#29)", () => {
    const landing = readProjectFile("app/m/[merchantSlug]/page.tsx")
    expect(landing).toContain("Get today's stamp")
    expect(landing).not.toContain("Collect my stamp")
  })

  it("states the merchant trial as card-required on public signup, pricing, and home pages", () => {
    const publicTrialPages = [
      readProjectFile("app/(auth)/signup/page.tsx"),
      readProjectFile("app/pricing/page.tsx"),
      readProjectFile("app/page.tsx"),
    ].join("\n")

    expect(publicTrialPages).toContain("30 days free")
    expect(publicTrialPages).toContain("Card required to go live")
    expect(publicTrialPages).toContain("card required to activate")
    expect(publicTrialPages).not.toMatch(/\b[Nn]o card\b/)
    expect(publicTrialPages).not.toContain(["no", "card"].join("-"))
  })
})
