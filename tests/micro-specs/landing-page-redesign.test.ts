import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { VenueRollCall } from "@/components/marketing"
import { STAMPING_VENUES } from "@/lib/marketing/venues"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("VenueRollCall — honest, quote-free social proof", () => {
  const html = renderToStaticMarkup(createElement(VenueRollCall))

  it("renders every supplied venue name and postcode", () => {
    for (const venue of STAMPING_VENUES) {
      expect(html, `${venue.name} name`).toContain(venue.name)
      expect(html, `${venue.name} postcode`).toContain(venue.postcode)
    }
  })

  it("carries no testimonial quotes", () => {
    expect(html).not.toContain("<blockquote")
    expect(html).not.toContain("&ldquo;")
  })
})

/**
 * The landing page is rebuilt to docs/NABAPERKS_SAAS_LANDING_BLUEPRINT.md —
 * the full 14-section acquisition flow, not a lightly-edited prior page. These
 * assertions pin the blueprint's section flow and copy so the page cannot
 * silently regress back to a thin variant.
 */
describe("landing page (app/page.tsx) — built to the SaaS blueprint", () => {
  const page = readProjectFile("app/page.tsx")

  it("hero uses the blueprint promise and audience eyebrow", () => {
    expect(page).toContain("No-app loyalty for food and drink venues")
    expect(page).toContain("Replace paper loyalty cards with one venue QR.")
    expect(page).toContain("save a browser card")
  })

  it("has the proof strip", () => {
    expect(page).toContain("<5 min")
    expect(page).toContain("<10 sec")
    expect(page).toContain("30 days")
  })

  it("has the problem section", () => {
    expect(page).toContain("Paper cards get lost. Apps get deleted.")
  })

  it("has the solution section (was missing before)", () => {
    expect(page).toContain("One QR at the counter. One card in the browser.")
  })

  it("has how-it-works with an anchor", () => {
    expect(page).toContain("Four taps from stranger to regular.")
    expect(page).toContain('id="how-it-works"')
  })

  it("has the five core benefits", () => {
    expect(page).toContain("No app, no plastic")
    expect(page).toContain("The phone never crosses the counter")
    expect(page).toContain("One stamp a day, honest")
    expect(page).toContain("Mystery rewards bring people back")
    expect(page).toContain("Built for food and drink venues")
  })

  it("has the product preview section (was missing before)", () => {
    expect(page).toContain("Merchant setup")
    expect(page).toContain("Customer card")
    expect(page).toContain("Reward collection")
  })

  it("has the trust section", () => {
    expect(page).toContain("Stamped, not tracked.")
    expect(page).toContain("Marketing is separate")
  })

  it("uses the real pilot venue roll-call as proof", () => {
    expect(page).toContain("VenueRollCall")
  })

  it("has the use-cases section (was missing before)", () => {
    expect(page).toContain("Made for food and drink regulars.")
    expect(page).toContain("Food-led pubs")
    expect(page).toContain("Takeaways")
  })

  it("has the pricing preview with anchor", () => {
    expect(page).toContain("£29")
    expect(page).toContain("30 days free")
    expect(page).toContain('id="pricing"')
  })

  it("has the FAQ with anchor", () => {
    expect(page).toContain("Do my customers need an app?")
    expect(page).toContain('id="faq"')
  })

  it("has the final CTA", () => {
    expect(page).toContain("Set up your venue this afternoon.")
  })

  it("keeps the F14 customer entry affordance", () => {
    expect(page).toContain('href="/home"')
    expect(page).toContain("Open my cards")
    expect(page).toContain('href="/scan"')
    expect(page).toContain("Scan a venue QR")
    expect(page).toMatch(/variant="(ghost|secondary)"/)
    expect(page).toContain("Start a merchant trial")
  })

  it("keeps the brand primitives and motion the suite pins", () => {
    expect(page).toContain("PageTitle")
    expect(page).toContain("SectionHeader")
    expect(page).toContain("pressable")
    expect(page).toContain("WetInkRise")
    expect(page).not.toContain("MotionReveal")
  })

  it("invents no testimonials (blueprint: avoid invented testimonials)", () => {
    for (const token of ["Maya", "Fern & Loaf", "Marlowe", "pilotVoices"]) {
      expect(page, `must not contain "${token}"`).not.toContain(token)
    }
  })

  it("wires the how-it-works and pricing anchors into navigation", () => {
    expect(page).toContain('href="#how-it-works"')
  })
})
