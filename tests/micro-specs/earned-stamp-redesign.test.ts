import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

const css = () => read("app/globals.css")
const grid = () => read("components/loyalty/stamp-grid.tsx")
const dot = () => read("components/loyalty/stamp-dot.tsx")
const venue = () => read("components/brand/venue-mark.tsx")

/**
 * Penny Post earned-stamp redesign — postage perforation + double ring, drawn
 * from one CSS hook so the disc stays shallow. See the design spec: the
 * perforation and inner ring move to ::before/::after, dashes belong to empty
 * slots only, tilt is seeded per slot, and VenueMark joins the stamp family.
 */
describe("earned stamp — Penny Post redesign", () => {
  it("draws perforation + inner ring as pseudo-elements, retiring the layer spans", () => {
    const c = css()
    expect(c).toContain('[data-stamp-earned="true"]::before')
    expect(c).toContain('[data-stamp-earned="true"]::after')
    // Perforation is a conic ring texture masked to the rim (allowed Wet Ink).
    expect(c).toContain("repeating-conic-gradient")
    expect(c).toMatch(/\[data-stamp-earned="true"\]::before[\s\S]*?mask:/)

    // The decorative spans and their helper classes are gone from both layers.
    for (const retired of [
      "w-royal-stamp-glow",
      "w-royal-stamp-perf",
      "w-royal-stamp-tick",
    ]) {
      expect(c, retired).not.toContain(retired)
      expect(grid(), retired).not.toContain(retired)
      expect(dot(), retired).not.toContain(retired)
    }
  })

  it("seeds a per-slot tilt (-5deg to -8deg) so the row reads hand-stamped", () => {
    const c = css()
    const g = grid()
    expect(c).toContain("--stamp-rot")
    expect(g).toContain("--stamp-rot")
    for (const tilt of ["-5deg", "-6deg", "-7deg", "-8deg"]) {
      expect(g, tilt).toContain(tilt)
    }
  })

  it("lands the slam animation on the slot's own tilt via WetInkSlam", () => {
    const g = grid()
    const d = dot()
    expect(d).toContain("WetInkSlam")
    expect(d).toContain("slammed")
    expect(g).toContain("--stamp-rot")
    expect(g).toContain('--stamp-rot": STAMP_TILTS')
  })

  it("sheds detail when compact: no perforation, date collapses to the day number", () => {
    const c = css()
    const d = dot()
    expect(c).toMatch(/data-compact="true"\]::before[\s\S]*?display:\s*none/)
    expect(d).toContain("data-compact")
    expect(d).toContain('date.split(" ")[0]')
  })

  it("keeps dashes for empty slots only — earned discs carry solid marks", () => {
    expect(dot()).not.toContain("border-dashed border-stamp-foreground")
  })

  it("unifies VenueMark into the stamp family: mono monogram + shared hook", () => {
    const v = venue()
    // Initials are a printed fact → Space Mono, not the spoken Bricolage default.
    expect(v).toContain("font-mono")
    expect(v).not.toContain("font-extrabold tracking-tight")
    // Shares the one decoration hook so header disc and card stamps are one object.
    expect(v).toContain('data-stamp-earned="true"')
  })
})
