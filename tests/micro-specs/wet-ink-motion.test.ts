import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

function stripSourceComments(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "")
}

const UI_SOURCE_ROOTS = ["app", "components", "lib/motion"] as const
const UI_SOURCE_EXTENSIONS = new Set([".css", ".ts", ".tsx"])

function collectUiSourceFiles(root: string): string[] {
  if (!existsSync(root)) return []

  const entries = readdirSync(root)
  const files: string[] = []

  for (const entry of entries) {
    const path = join(root, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      files.push(...collectUiSourceFiles(path))
      continue
    }

    if (UI_SOURCE_EXTENSIONS.has(extname(path))) {
      files.push(path)
    }
  }

  return files.map((path) => path.replaceAll("\\", "/"))
}

function uiSourceFiles(): string[] {
  return UI_SOURCE_ROOTS.flatMap((root) => collectUiSourceFiles(root))
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

  it("aligns WetInkRise to the 320ms design-system move token", () => {
    const tokens = read("lib/motion/tokens.ts")

    expect(tokens, "WetInkRise still uses the old 400ms reveal timing").toMatch(
      /rise:\s*{\s*duration:\s*0\.32,/
    )
  })

  it("keeps legacy CSS duration aliases as Wet Ink token wrappers only", () => {
    const css = read("app/globals.css")

    expect(css, "--w-dur-fast token missing").toContain("--w-dur-fast: 150ms")
    expect(css, "--duration-fast must alias --w-dur-fast").toContain(
      "--duration-fast: var(--w-dur-fast)"
    )
    expect(css, "--duration-reveal must alias --w-dur-move").toContain(
      "--duration-reveal: var(--w-dur-move)"
    )
    expect(css, "--ease-stamp must alias --w-ease").toContain(
      "--ease-stamp: var(--w-ease)"
    )
  })

  it("provides use-reduced-motion.ts hook for static fallbacks", () => {
    const source = read("lib/motion/use-reduced-motion.ts")

    // File exists and exports a hook
    expect(source.length).toBeGreaterThan(0)
    expect(source, "useReducedMotion hook missing").toContain(
      "useReducedMotion"
    )
  })

  it("keeps the reduced-motion hook SSR-compatible until hydration", () => {
    const source = read("lib/motion/use-reduced-motion.ts")

    expect(source).toContain("useEffect")
    expect(source).toContain("matchMedia")
    expect(source).toContain("setReducedMotion")
    expect(source).not.toContain("useMotionReduced")
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

  it("ensures no raw w-* animations remain in motion consumers", () => {
    for (const path of uiSourceFiles()) {
      const content = stripSourceComments(read(path))
      // Fail on either raw form — inline `animation: "w-*"` JS styles or the
      // Tailwind arbitrary `animate-[w-*]` utility. Both must route through the
      // WetInk* Framer primitives instead.
      expect(
        content,
        `${path} still has inline animation: "w-*" style`
      ).not.toMatch(/animation:\s*["']w-/)
      expect(
        content,
        `${path} still uses the animate-[w-*] keyframe utility`
      ).not.toMatch(/animate-\[w-/)
    }
  })

  it("keeps direct motion/react imports inside the motion library boundary", () => {
    const offenders = uiSourceFiles().filter((path) => {
      if (path.startsWith("components/motion/")) return false
      if (path === "lib/motion/use-reduced-motion.ts") return false

      return /from\s+["']motion\/react["']/.test(read(path))
    })

    expect(offenders).toEqual([])
  })

  it("keeps UI transition classes on Wet Ink duration and easing tokens", () => {
    const ignoredFiles = new Set([
      "app/globals.css",
      "components/motion/stamp-celebration.tsx",
      "components/motion/wet-ink.tsx",
      "lib/motion/tokens.ts",
    ])
    const numericDurationPattern = /\bduration-(?:75|100|150|200|300|500|700|1000)\b/
    const legacyTokenPattern =
      /\bduration-\[var\(--duration-(?:fast|reveal)\)\]|\bease-\[var\(--ease-stamp\)\]/
    const genericTransitionPattern = /(^|[\s"'`])transition(?=($|[\s"'`]))/
    const nonTokenEasePattern = /\bease-(?:in|out|in-out|linear)\b/

    const offenders = uiSourceFiles().flatMap((path) => {
      if (ignoredFiles.has(path)) return []

      const content = stripSourceComments(read(path))
      const matches = [
        numericDurationPattern.test(content) ? "numeric duration" : null,
        legacyTokenPattern.test(content) ? "legacy motion alias" : null,
        genericTransitionPattern.test(content) ? "generic transition" : null,
        nonTokenEasePattern.test(content) ? "non-token easing" : null,
      ].filter((match) => match !== null)

      return matches.map((match) => `${path}: ${match}`)
    })

    expect(offenders).toEqual([])
  })

  it("replaces Radix sheet animation classes with tokenized lifecycle transitions", () => {
    const source = read("components/ui/sheet.tsx")

    expect(source).not.toMatch(/data-open:animate|data-closed:animate/)
    expect(source).not.toMatch(/fade-(?:in|out)|slide-(?:in|out)-from/)
    expect(source).toContain("duration-[var(--w-dur-move)]")
    expect(source).toContain("duration-[var(--w-dur-fast)]")
    expect(source).toContain("ease-[var(--w-ease)]")
    expect(source).toContain("motion-reduce:transition-none")
  })

  it("keeps loading pulses, spinners, and OTP caret static under reduced motion", () => {
    const skeleton = read("components/ui/skeleton.tsx")
    const spinner = read("components/ui/spinner.tsx")
    const sonner = read("components/ui/sonner.tsx")
    const otp = read("components/ui/input-otp.tsx")

    expect(skeleton).toContain("motion-reduce:animate-none")
    expect(spinner).toContain("motion-reduce:animate-none")
    expect(sonner).toContain("motion-reduce:animate-none")
    expect(otp).toContain("motion-reduce:animate-none")
  })

  it("routes StampCelebration through Wet Ink tokens and reduced-motion hook", () => {
    const source = read("components/motion/stamp-celebration.tsx")

    expect(source).toContain("useReducedMotionHook")
    expect(source).toContain("wetInkTransition")
    expect(source).not.toMatch(
      /import\s*{[^}]*useReducedMotion[^}]*}\s*from\s*["']motion\/react/
    )
    expect(source).not.toContain("stampEase")
    expect(source).not.toMatch(/duration:\s*0\.\d+/)
  })

  it("removed every @keyframes w-* from globals.css (Framer owns motion)", () => {
    const css = read("app/globals.css")

    expect(css, "globals.css still defines a @keyframes w-* block").not.toMatch(
      /@keyframes\s+w-/
    )
  })

  it("migrated former MotionReveal consumers onto WetInkRise", () => {
    const files = [
      "components/merchant/dashboard-home-streams.tsx",
      "components/merchant/activity-detail-feed.tsx",
      "app/page.tsx",
    ]

    for (const path of files) {
      const content = read(path)
      expect(content, `${path} still references MotionReveal`).not.toMatch(
        /MotionReveal/
      )
      expect(content, `${path} should use WetInkRise`).toContain("WetInkRise")
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
