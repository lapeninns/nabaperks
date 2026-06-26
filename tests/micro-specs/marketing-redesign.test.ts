import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

/** Common emoji / pictograph planes. The ✱ wordmark disc (U+2731) is the only
 *  sanctioned dingbat, so it is stripped before matching. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u
const stripWordmark = (source: string) => source.replaceAll("✱", "")

/**
 * Marketing surface redesign contracts (Mk* reference parity).
 *
 * The marketing "riso poster with three rooms" composes the reference MkNav,
 * MkHero, MkPricing, MkFaqItem, and MkFooter structure with Wet Ink tokens and
 * the WetInk* motion library — and drops the prototype's localStorage view-state
 * for real routing. Source-analysis only (no RTL), matching the repo model.
 */
describe("marketing surface redesign contracts", () => {
  it("scrolls the marquee through WetInkMarquee, not a raw keyframe", () => {
    const marquee = read("components/marketing/marquee.tsx")

    expect(marquee).toContain("WetInkMarquee")
    expect(marquee, "marquee must not use a raw w-* keyframe").not.toMatch(
      /animate-\[w-|animation:\s*["']w-/
    )
    // Dark ink riso band, decorative (hidden from assistive tech), ✱ separator.
    expect(marquee).toContain("bg-ink")
    expect(marquee).toContain('aria-hidden="true"')
    expect(marquee).toContain("✱")
  })

  it("composes the marketing shell from MkNav + MkFooter with no localStorage view-state", () => {
    const layout = read("components/layout/marketing-layout.tsx")

    // Marquee + nav with signup CTAs + footer with legal links (MkNav / MkFooter).
    expect(layout).toContain("Marquee")
    expect(layout).toContain("<nav")
    expect(layout).toContain("<footer")
    expect(layout).toContain('href="/signup"')
    expect(layout).toContain('href="/terms"')
    expect(layout).toContain('href="/privacy"')

    // Real routing, not the prototype's localStorage surface machine.
    expect(layout).not.toContain('"use client"')
    expect(layout).not.toContain("localStorage")
    expect(layout).not.toContain("useState")
  })

  it("renders the MkHome hero with the loyalty vocabulary and WetInk motion", () => {
    const home = read("app/page.tsx")
    const hero = read("components/marketing/hero-loyalty-card.tsx")
    const homeSurface = `${home}\n${hero}`

    // Entrance motion routes through the primitive, never a raw keyframe.
    expect(home).toContain("MarketingHeroLoyaltyCard")
    expect(home).not.toMatch(/animate-\[w-|MotionReveal/)

    // The live receipt + join demo reuses the shared loyalty/brand vocabulary.
    expect(homeSurface).toContain("StampGrid")
    expect(homeSurface).toContain("VenueMark")
    expect(homeSurface).toContain("QrFrame")
    expect(home).toContain("Eyebrow")

    // Value-first merchant CTA copy.
    expect(home).toContain("Start a merchant trial")
  })

  it("keeps the marketing home compact instead of a full sales-deck scroll", () => {
    const home = read("app/page.tsx")
    const sectionCount = home.match(/^\s*<section/gm)?.length ?? 0
    const faqCount = home.match(/^\s*q:/gm)?.length ?? 0

    expect(sectionCount).toBeLessThanOrEqual(8)
    expect(faqCount).toBeLessThanOrEqual(5)

    expect(home).not.toContain("MarketingProblemSection")
    expect(home).not.toContain("MarketingSolutionSection")
    expect(home).not.toContain("pilotVenues")
    expect(home).not.toContain("useCases")
  })

  it("prints the single-plan MkPricing receipt and an accordion FAQ", () => {
    const pricing = read("app/pricing/page.tsx")

    // Single £29 plan, billed in GBP through Stripe.
    expect(pricing).toContain("£29")
    expect(pricing).toContain("GBP 29")
    // Native single-open accordion (MkFaqItem) with a pressable summary.
    expect(pricing).toContain("<details")
    expect(pricing).toContain("<summary")
    expect(pricing).toContain("pressable")
  })

  it("keeps marketing copy free of emoji (the ✱ wordmark disc aside)", () => {
    for (const path of [
      "app/page.tsx",
      "app/pricing/page.tsx",
      "components/layout/marketing-layout.tsx",
      "components/marketing/marquee.tsx",
    ]) {
      expect(
        stripWordmark(read(path)),
        `${path} contains an emoji`
      ).not.toMatch(EMOJI)
    }
  })
})
