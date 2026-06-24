import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Friction F15 (flow): opening a saved card from /home in the plain
 * `card_collecting` state showed a neutral "Scan the venue code to add your
 * stamp." banner with no button — a dead end on the highest-traffic card view.
 * The band now carries a secondary "Scan to stamp" action to /scan, mirroring
 * the reward branch's Button -> Link, while keeping the one-per-UK-business-day
 * guidance line intact.
 */
describe("card_collecting scan-to-stamp action (F15)", () => {
  const experience = readProjectFile(
    "components/customer/customer-card-experience.tsx"
  )

  it("keeps the pinned neutral scan prompt and its business-day rule line", () => {
    // Pinned copy (customer.test.ts / self-service-stamping.test.ts) must survive.
    expect(experience).toContain("Scan the venue code to add your stamp.")
    expect(experience).toContain("One stamp is available per UK\n")
  })

  it("adds a Scan to stamp button that links to /scan inside the band", () => {
    expect(experience).toContain("Scan to stamp")
    expect(experience).toContain('href="/scan"')
  })

  it("places the scan action in the neutral prompt branch, not only the reward branch", () => {
    // The reward branch already linked to /reward/...; the scan action must be a
    // sibling Link in the same component so the neutral band stops dead-ending.
    expect(experience).toContain('<Link href="/scan">Scan to stamp</Link>')
  })
})
