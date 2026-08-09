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
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      acc.push(relative)
    }
  }
  return acc
}

/**
 * 03#25 — DESIGN.md: "Borders are 2px solid ink everywhere; 2px dashed
 * (`.w-rule`) for empty slots". A 1.5px hairline renders differently at 1x and
 * 2x and reads as a third weight between `border-border` and the 2px ink.
 *
 * Eleven Tailwind call sites were swept out once and one came back days later
 * in an unrelated commit (see the note at the `details[data-just-updated]` rule
 * in app/globals.css). This makes the sweep enforceable rather than a habit.
 */
test("no Tailwind class reintroduces the 1.5px border weight", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  // A filter that eats its whole input would pass this test on zero files.
  assert.ok(files.length > 500, `expected a real source tree, got ${files.length}`)

  const offenders = files.filter((file) =>
    /border-\[1\.5px\]/.test(read(file))
  )

  assert.deepEqual(offenders, [])
})

test("the one surviving 1.5px border is .w-tag, and it is escalated", () => {
  const globals = read("app", "globals.css")
  const declarations = [
    ...globals.matchAll(/border(?:-[a-z-]+)?:\s*1\.5px[^;]*;/g),
  ].map(([match]) => match)

  // Exactly one, and it is the mono pill DESIGN.md sanctions as a shape but
  // not as a weight. Raising it to 2px changes every MonoTag in the product,
  // so it is a visual decision: NEEDS-SIGNOFF.md section 17.
  assert.deepEqual(declarations, ["border: 1.5px solid var(--w-line);"])

  const tagRule = globals.slice(
    globals.indexOf("  .w-tag {"),
    globals.indexOf("}", globals.indexOf("  .w-tag {"))
  )
  assert.match(tagRule, /border: 1\.5px solid var\(--w-line\);/)

  // The deviation is documented where it lives, not only in the audit docs.
  const preamble = globals.slice(
    Math.max(0, globals.indexOf("  .w-tag {") - 1200),
    globals.indexOf("  .w-tag {")
  )
  assert.match(preamble, /NEEDS-SIGNOFF/)
})

/**
 * 03#25, decided against DESIGN.md — the second half of the deviation, which
 * the original entry did not record.
 *
 * DESIGN.md "Shapes" grants `.w-tag` exactly one exemption, and it is a SHAPE
 * one: "The mono pill `.w-tag` is the only generic pill shape outside the stamp
 * family." The same paragraph says "Borders are 2px solid ink everywhere". No
 * weight exemption is granted anywhere in the document.
 *
 * DESIGN.md "Elevation & Depth" then scopes the token itself: "Dashed lines
 * come in two tones only: `--w-line` (18%, receipt rules, empty stamp slots)
 * and `--w-line-strong` (50%, empty reward slots and ticket perforations)."
 * `--w-line` is a DASHED tone. `.w-tag` draws it SOLID, and it is the only rule
 * in the stylesheet that does — every other solid border here is 2px of ink or
 * of a spot ink.
 *
 * So the deviation is not "1.5px instead of 2px". It is a third stroke weight
 * AND a stroke colour the system reserves for dashes, on the one utility that
 * renders in ~52 files. Whoever raises the weight must also decide the colour;
 * this pins both so the second half cannot be missed twice.
 *
 * DESIGN.md "Badges & Tags" closes the loop: "The metric source of truth is the
 * unlayered `[data-slot="badge"]` rule; `.w-tag` is its documented alias." That
 * rule sets no border at all, so the source of truth gives 1.5px no cover
 * either.
 */
test("`.w-tag` is the only solid border drawn in the dashed-only --w-line tone", () => {
  const globals = read("app", "globals.css")

  const solidBorders = [
    ...globals.matchAll(/border(?:-[a-z-]+)?:\s*[\d.]+px\s+solid\s[^;]+;/g),
    // Whitespace-normalised: two of these declarations wrap over a line, and a
    // literal comparison against the wrapped form breaks the next time
    // prettier reflows the stylesheet.
  ].map(([match]) => match.replace(/\s+/g, " "))

  // A regex that matched nothing would pass the filter below on an empty list.
  assert.ok(
    solidBorders.length > 15,
    `expected the real stylesheet, got ${solidBorders.length} solid borders`
  )

  const drawnInLineTone = solidBorders.filter((declaration) =>
    /var\(--w-line\)/.test(declaration)
  )

  assert.deepEqual(drawnInLineTone, ["border: 1.5px solid var(--w-line);"])

  // And it is the only sub-2px border box in the file. The 2.5px pair at
  // `.ink-check::after` is a tick GLYPH built from two edges, not a box, so it
  // is matched and excluded by name rather than by a width threshold that
  // would quietly admit the next 1px hairline.
  const inkCheckGlyph = /border-(?:left|bottom): 2\.5px solid var\(--primary-foreground\);/
  const subTwoPixel = solidBorders.filter(
    (declaration) =>
      !inkCheckGlyph.test(declaration) &&
      Number(declaration.match(/([\d.]+)px/)[1]) < 2
  )

  assert.deepEqual(subTwoPixel, [
    "border: 1.5px solid var(--w-line);",
    "border: 1px solid color-mix(in oklch, var(--stamp-foreground) 50%, transparent);",
  ])
})
