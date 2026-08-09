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
