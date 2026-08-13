import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(path.join(projectRoot, dir))) {
    const relative = path.join(dir, entry)
    const absolute = path.join(projectRoot, relative)
    if (statSync(absolute).isDirectory()) {
      sourceFiles(relative, acc)
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(relative)
    }
  }
  return acc
}

/** Every fix below documents itself beside the code, quoting the string it
 *  replaced. Scanning raw source would make each explanation its own
 *  violation — the reason wet-ink-opaque-chrome strips comments first. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

/**
 * DESIGN.md "Typography":
 *
 *   "Do not hand-roll `font-mono text-[0.x rem] tracking-[…] uppercase`
 *    strings — reach for one of these utilities and add colour at the call
 *    site."
 *
 * Seven surfaces hand-rolled it anyway, and `tokens:check` could not see them
 * because it enforces the 10px FLOOR, not the two-size scale: the reward-scan
 * card id and its harness twin, the invite claim page's venue eyebrow (which
 * also set Tailwind's 0.025em `tracking-wide` against the contract's 0.06em),
 * and the four print-preview routes. They are now `.mono-meta` / `.eyebrow`.
 *
 * The ban is scoped to the MICRO register the clause is about, so a mono
 * DISPLAY size stays legal: RewardTicket's 16px REDEEMED slam and
 * StampPressButton's 18/20px face are mono uppercase by design and are not
 * what "text-[0.x rem]" describes.
 */
test("nothing hand-rolls the micro mono register", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  // A filter that ate its whole input would pass this test on zero files.
  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  let monoStringsSeen = 0
  const offenders = []

  for (const file of files) {
    const source = stripComments(read(file))
    for (const [literal] of source.matchAll(/"[^"\n]*\bfont-mono\b[^"\n]*"/g)) {
      monoStringsSeen += 1
      if (!/\buppercase\b/.test(literal)) continue
      if (!/\btext-xs\b/.test(literal)) continue
      offenders.push(`${file}: ${literal.slice(0, 90)}`)
    }
  }

  // The matcher must still find real mono strings, or "no offenders" is "no
  // input" — the bundle:check failure mode this repo has already shipped once.
  assert.ok(
    monoStringsSeen > 15,
    `expected the tree's font-mono strings, got ${monoStringsSeen}`
  )

  assert.deepEqual(offenders, [])
})

/**
 * The size half of the same clause: "Below `text-xs` there are exactly two
 * sanctioned sizes … `.mono-meta` … `.mono-id`. **10px is the system floor**".
 *
 * `scripts/check-design-tokens.mjs` enforces the FLOOR — it fails on an
 * arbitrary under 10px. It does not enforce "exactly two", so an arbitrary
 * BETWEEN 10px and text-xs passes every gate in the repo. One does:
 * StampDot's earned initials at `text-[0.69rem]` (11.04px), a third size in
 * the micro register.
 *
 * It is recorded here rather than swept. The stamp face is the product's
 * signature mark, 121 visual baselines are already awaiting human diff
 * approval, and moving 11.04px to `.mono-meta`'s 11.5px changes two glyphs
 * inside a 36px disc — a visual approval, not a codemod. Pinned by exact
 * value so it cannot spread and cannot be "tidied" without this test noticing.
 */
test("the only sub-text-xs arbitrary left is StampDot's, at the known value", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  const found = []

  for (const file of files) {
    const source = stripComments(read(file))
    for (const [, value] of source.matchAll(/\btext-\[([\d.]+)rem\]/g)) {
      // Below text-xs (0.75rem) is the micro register the clause governs.
      if (Number(value) >= 0.75) continue
      found.push(`${file}: text-[${value}rem]`)
    }
  }

  assert.deepEqual(found.sort(), [
    path.join("components", "loyalty", "stamp-dot.tsx") + ": text-[0.69rem]",
  ])
})

/**
 * DESIGN.md "Iconography":
 *
 *   "Render every icon through the brand `Icon` wrapper
 *    (`components/brand/icon.tsx`) … Pull glyphs from
 *    `@hugeicons/core-free-icons`."
 *
 * Three functional glyphs were raw text instead: the marketing footer's
 * disclosure caret and the legal TOC's disclosure caret, both "▾", and the
 * snap-rail swipe hint's "→". A text arrow sets in Bricolage at whatever
 * metrics the font gives it, carries no 2px house stroke, and cannot be
 * swapped through the shared semantic maps. All three now render
 * ArrowDown01Icon / ArrowRight01Icon through `Icon`, the same glyphs
 * Disclosure, MarketingDisclosure, SelectField, ProfileSection and DataTable
 * already turn.
 *
 * The ✱ disc is deliberately NOT in this set: DESIGN.md calls it "the brand
 * signature … **not** a general-purpose icon — do not swap it for a Hugeicons
 * glyph."
 */
test("no functional glyph ships as raw text instead of the Icon wrapper", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  // Carets, arrows and ticks — the glyphs a Hugeicons icon exists for. The ✱
  // brand signature is absent by design.
  const RAW_GLYPHS = /[\u25B2\u25B4\u25B8\u25BC\u25BE\u25C2\u2190-\u2193\u2713\u2714\u2715\u2716]/

  const offenders = []

  for (const file of files) {
    const source = stripComments(read(file))
    for (const [, text] of source.matchAll(/>([^<>{}]*)</g)) {
      if (!RAW_GLYPHS.test(text)) continue
      // Prose may legitimately contain an arrow ("Referrer → referred" is a
      // column heading, not an icon). A glyph that is the WHOLE text node is
      // an icon wearing a character.
      if (text.trim().length > 2) continue
      offenders.push(`${file}: ${JSON.stringify(text.trim())}`)
    }
  }

  assert.deepEqual(offenders, [])
})

test("DESIGN.md still carries the clauses these three tests enforce", () => {
  const design = read("DESIGN.md")
  assert.match(
    design,
    /Do not hand-roll `font-mono text-\[0\.x rem\] tracking-\[…\] uppercase`/
  )
  assert.match(design, /10px is the system\s+floor/)
  assert.match(design, /Render\s+every icon through the brand `Icon` wrapper/)
})
