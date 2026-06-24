import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { stampAnnouncement } from "@/lib/customer/experience/stamp-announcement"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Rank 1 of the customer-flow friction audit: the product's core action is silent
 * for screen-reader and reduced-motion customers. `stampAnnouncement` is the pure
 * source of the polite live-region text, so the in-flight progress and the new
 * count are spoken — not just shown in motion the customer may never see.
 */
describe("stampAnnouncement (screen-reader progress for the stamp mechanic)", () => {
  it("stays silent while idle so the live region never speaks on mount", () => {
    expect(
      stampAnnouncement({
        inFlight: false,
        committed: false,
        displayCurrent: 1,
        total: 5,
        cardComplete: false,
      })
    ).toBe("")
  })

  it("announces in-flight progress that today's plain hint never spoke", () => {
    expect(
      stampAnnouncement({
        inFlight: true,
        committed: false,
        displayCurrent: 2,
        total: 5,
        cardComplete: false,
      })
    ).toBe("Adding your stamp.")
  })

  it("announces the new count once the stamp lands", () => {
    expect(
      stampAnnouncement({
        inFlight: false,
        committed: true,
        displayCurrent: 2,
        total: 5,
        cardComplete: false,
      })
    ).toBe("Stamp added. That's 2 of 5.")
  })

  it("generalises the count rather than hardcoding a single value", () => {
    expect(
      stampAnnouncement({
        inFlight: false,
        committed: true,
        displayCurrent: 3,
        total: 8,
        cardComplete: false,
      })
    ).toBe("Stamp added. That's 3 of 8.")
  })

  it("announces completion when the final stamp lands", () => {
    expect(
      stampAnnouncement({
        inFlight: false,
        committed: true,
        displayCurrent: 5,
        total: 5,
        cardComplete: true,
      })
    ).toBe("Stamp added. That's the full card, your reward is unlocked.")
  })
})

describe("stamp mechanic accessible wiring", () => {
  it("drives a polite live region from the announcement helper", () => {
    const collector = readProjectFile("components/customer/stamp-collector.tsx")
    expect(collector).toContain("stampAnnouncement")
    expect(collector).toContain('role="status"')
    expect(collector).toContain('aria-live="polite"')
  })

  it("exposes the press-and-hold gesture without changing the button name", () => {
    const button = readProjectFile("components/customer/stamp-press-button.tsx")
    // Accessible name preserved for the e2e role-name locators.
    expect(button).toContain('aria-label={secured ? "Stamp added" : label}')
    // The gesture is surfaced as a description, not folded into the name.
    expect(button).toContain("aria-describedby")
    expect(button).toContain("press and hold")
  })
})
