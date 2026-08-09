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
 * Comments explain the ban and therefore quote the banned tokens. Scanning raw
 * source would make every explanation its own violation — the failure mode the
 * motion-vocabulary test accepts deliberately and this one cannot, because the
 * whole point here is that the reason is written down beside the fix.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

/**
 * DESIGN.md, "Elevation & Depth":
 *
 *   "Transparency is for scrims only (rgba(33,28,22,0.5) under sheets). No
 *    glassmorphism, no photography; the optional paper grain
 *    (`<body data-grain="true">`) is the only texture."
 *
 * Four merchant chrome surfaces had shipped as a translucent paper/card wash
 * under a `backdrop-filter` blur — the sticky poster header, the poster action
 * bar, the poster sidecar, the launch form action bar and the reward-pool
 * selection tray. That is glassmorphism by its textbook definition, and on the
 * reward tray it also cost legibility: the tray floats over the reward list it
 * is counting, so the wash put reward names behind its own count line.
 *
 * Separation on an ink system comes from the 2px border and the hard offset
 * shadow, not from a blur. Scrims stay sanctioned: a full-bleed overlay
 * (`fixed inset-0`) under a dialog or sheet is the one case DESIGN.md names.
 */
test("no chrome surface is frosted glass; only full-bleed scrims may blur", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  // A filter that eats its whole input would pass this test on zero files.
  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  const offenders = []

  for (const file of files) {
    const source = stripComments(read(file))

    for (const [attribute] of source.matchAll(
      /className=(?:"[^"]*"|\{[^}]*\})/g
    )) {
      if (!/backdrop-blur|backdrop-filter/.test(attribute)) continue
      // The scrim exception, spelled the only way the codebase spells it.
      if (/fixed inset-0/.test(attribute)) continue
      offenders.push(`${file}: ${attribute.slice(0, 80)}`)
    }
  }

  assert.deepEqual(offenders, [])
})

/**
 * The other half of the same rule: chrome — anything `fixed` or `sticky` that
 * frames the page — never washes the paper or card GROUND. Tone washes are a
 * different thing and stay sanctioned: DESIGN.md's Toasts & feedback section
 * describes `StatusBanner` as the component "which adds the tone washes", and
 * the reward-preset tiles tint their state with `bg-reward/5` / `bg-seal/10`.
 * Those are ink applied to paper. `bg-card` and `bg-paper` ARE the paper, and a
 * see-through page frame is the glassmorphism the section above bans.
 */
test("fixed and sticky chrome never washes the paper or card ground", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  const offenders = []

  for (const file of files) {
    const source = stripComments(read(file))

    for (const [attribute] of source.matchAll(
      /className=(?:"[^"]*"|\{[^}]*\})/g
    )) {
      if (!/\b(?:fixed|sticky)\b/.test(attribute)) continue
      if (!/\bbg-(?:card|paper)\/\d/.test(attribute)) continue
      offenders.push(`${file}: ${attribute.slice(0, 80)}`)
    }
  }

  assert.deepEqual(offenders, [])
})
