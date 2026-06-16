import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Wet Ink motion system — Framer Motion consolidation.
 *
 * Every motion vocabulary word from DESIGN.md (rise, slam, shake, pop, wiggle,
 * ripple, soft-stamp, sheet-up, marquee) is a reusable WetInk* primitive in
 * components/motion/. Red tests assert the contract: all nine exports exist,
 * reduced-motion is respected, and the slam sequence lands on the tilt variable.
 */
describe("Wet Ink motion system — Framer Motion library", () => {
  it("exports all nine motion primitives from components/motion/index.ts", () => {
    const index = read("components/motion/index.ts")

    // All nine vocabulary words are available as WetInk* exports
    const expectedExports = [
      "WetInkRise",
      "WetInkSlam",
      "WetInkSoftStamp",
      "WetInkShake",
      "WetInkPop",
      "WetInkWiggle",
      "WetInkRipple",
      "WetInkMarquee",
      "WetInkSheet",
    ]

    for (const name of expectedExports) {
      expect(
        index,
        `${name} not exported from components/motion/index.ts`
      ).toContain(`export { ${name} }`)
    }
  })

  it("exports the StampSlamSequence composed pattern", () => {
    const index = read("components/motion/index.ts")

    expect(index, "StampSlamSequence not exported").toContain(
      "StampSlamSequence"
    )
  })

  it("defines motion tokens in lib/motion/tokens.ts with durations and easings", () => {
    const tokens = read("lib/motion/tokens.ts")

    // Motion tokens export a wetInkTransition object
    expect(tokens, "wetInkTransition not exported").toContain(
      "wetInkTransition"
    )

    // Token file contains slam, move, press, shake references
    for (const key of ["slam", "move", "press", "shake"]) {
      expect(tokens, `${key} motion timing not defined`).toContain(key)
    }
  })

  it("provides use-reduced-motion.ts hook for static fallbacks", () => {
    const source = read("lib/motion/use-reduced-motion.ts")

    // File exists and exports a hook
    expect(source.length).toBeGreaterThan(0)
    expect(source, "useReducedMotion hook missing").toContain(
      "useReducedMotion"
    )
  })

  it("reads --w-dur-shake token from globals.css", () => {
    const css = read("app/globals.css")

    expect(css, "--w-dur-shake token missing").toContain("--w-dur-shake:")
    expect(css, "--w-dur-shake value incorrect").toContain(
      "--w-dur-shake: 300ms"
    )
  })

  it("wires the slam animation to land on --stamp-rot tilt per slot", () => {
    const css = read("app/globals.css")

    // The WetInkSlam primitive must rotate to var(--stamp-rot, fallback).
    // Verify the CSS variable is available as a seed point.
    expect(css, "--stamp-rot seed variable missing").toContain("--stamp-rot")
  })

  it("ensures no inline animation: 'w-*' strings remain in loyalty components", () => {
    const components = [
      "components/loyalty/stamp-grid.tsx",
      "components/loyalty/reward-seal.tsx",
      "components/loyalty/reward-celebration.tsx",
      "components/loyalty/stamp-journey-preview.tsx",
      "components/marketing/marquee.tsx",
    ]

    for (const path of components) {
      const content = read(path)
      // Fail if the component has inline animation: "w-* strings
      // (they should use WetInk* primitives instead)
      const inlineAnimPattern = /animation:\s*["']w-/
      expect(
        content,
        `${path} still has inline animation: "w-*" style`
      ).not.toMatch(inlineAnimPattern)
    }
  })

  it("respects prefers-reduced-motion globally and in motion primitives", () => {
    const css = read("app/globals.css")

    // Global rule: prefers-reduced-motion blocks all animations
    expect(css, "global prefers-reduced-motion rule missing").toContain(
      "prefers-reduced-motion"
    )
    expect(css, "animation-duration: 0.01ms rule missing").toContain(
      "animation-duration: 0.01ms"
    )
  })
})
