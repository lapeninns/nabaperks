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

/** The audit prose and the fix comments quote the offending tokens, so the
 *  explanation would otherwise be its own violation — the same reason
 *  wet-ink-opaque-chrome strips comments before it scans. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

/**
 * DESIGN.md "Elevation & Depth":
 *
 *   "Dashed lines come in two tones only: `--w-line` (18%, receipt rules,
 *    empty stamp slots) and `--w-line-strong` (50%, empty reward slots and
 *    ticket perforations)."
 *
 * "Two tones only" shipped as SIX. Thirty dashed rules across nineteen merchant
 * files drew `border-ink/15`, `/20`, `/25`, `/30`, `/35` and `/50` — a
 * per-call-site opacity for one semantic. The customer lane (02#9, 02#70) and
 * the admin lane (04#53, 04#73) had each swept their own tree to `border-line`;
 * the merchant tree, which holds most of the dashed surface area in the
 * product, had never been swept and nothing stopped the next one.
 *
 * `--color-line` / `--color-line-strong` already exist in the theme precisely
 * so a dashed rule names a tone instead of numbering one. `/50` became
 * `border-line-strong` at identical pixels; every lighter tone became
 * `border-line`.
 *
 * Scope note, so the next reader does not mistake this for a wider ban: SOLID
 * `border-ink/NN` is a different question. DESIGN.md's sentence scopes both
 * tones to DASHED lines, and the solid low-alpha border is the unselected-tile
 * state the audit's own 03#26 recommends. Those are untouched and written up
 * for the owner rather than swept in on this clause's authority.
 */
test("every dashed rule names one of DESIGN.md's two tones", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  // A filter that ate its whole input would pass this test on zero files.
  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  // Both of DESIGN.md's tones are INK on paper. A dashed rule on an ink
  // GROUND cannot use either — 18% ink on ink is invisible — and the document
  // gives no on-ink dashed tone at all, though it does give an on-ink shadow
  // and border story (`[data-on-ink]`). ScarcityBand is the one surface that
  // needs one and it invented `border-paper/40`. Named, not pattern-matched,
  // so a SECOND on-ink dash still fails here and forces the DESIGN.md decision
  // instead of quietly joining an exception. Written up for the owner.
  const ON_INK_DASH = path.join(
    "components",
    "marketing",
    "landing",
    "scarcity-band.tsx"
  )

  const offenders = []
  let dashedSeen = 0

  for (const file of files) {
    const source = stripComments(read(file))
    for (const [literal] of source.matchAll(
      /"[^"\n]*\bborder-dashed\b[^"\n]*"/g
    )) {
      dashedSeen += 1
      // An alpha-numbered ink or spot-ink stroke on a dashed line is a third
      // (fourth, fifth, sixth) tone by definition.
      const numbered = literal.match(/border-[a-z-]+\/\d+/g)
      if (!numbered) continue
      if (file === ON_INK_DASH && numbered.join(" ") === "border-paper/40") {
        continue
      }
      offenders.push(`${file}: ${numbered.join(" ")}`)
    }
  }

  // The matcher must still be finding real dashed rules, or "no offenders"
  // means "no input".
  assert.ok(
    dashedSeen > 25,
    `expected the tree's dashed rules, got ${dashedSeen}`
  )

  assert.deepEqual(offenders, [])
})

test("the two tones are minted as colours and DESIGN.md still says two", () => {
  const globals = read("app", "globals.css")
  assert.match(globals, /--color-line:\s*var\(--w-line\);/)
  assert.match(globals, /--color-line-strong:\s*var\(--w-line-strong\);/)

  const design = read("DESIGN.md")
  assert.match(design, /Dashed lines come in two\s+tones only/)

  // And the tones are what the document says they are, so `border-line` cannot
  // be quietly re-pointed to a third value while this test keeps passing.
  const rootBlock = globals.slice(
    globals.indexOf(":root {"),
    globals.indexOf(".dark {")
  )
  assert.ok(
    rootBlock.length > 1000,
    `expected the :root token block, got ${rootBlock.length} chars`
  )
  assert.match(rootBlock, /--w-line:\s*rgba\(33, 28, 22, 0\.18\);/)
  assert.match(rootBlock, /--w-line-strong:\s*rgba\(33, 28, 22, 0\.5\);/)
})
