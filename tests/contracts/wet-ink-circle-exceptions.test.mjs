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

/** The fixes document themselves beside the class string, so they quote the
 *  banned token. Scanning raw source would make each explanation its own
 *  offender — the same reason wet-ink-opaque-chrome strips first. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

/**
 * DESIGN.md "Shapes":
 *
 *   "**Full circles are reserved for the stamp family** — stamps, seals,
 *    marks — always rotated -6° to -8°. Named circle exceptions are narrow and
 *    intentional: … new framing circles reach for `IconRoundel` rather than
 *    hand-rolling `rounded-full`, and the list does not grow without updating
 *    this contract."
 *
 * "The list does not grow without updating this contract" was, until now, a
 * sentence rather than a check — nothing in `tests/` looked at `rounded-full`
 * outside `marketing-layout.tsx`. This is the whole-tree version: every FRAMING
 * circle (a `rounded-full` box that centres its content) must live in a file on
 * the list below, so adding one anywhere else fails here and forces the DESIGN.md
 * edit the clause asks for.
 *
 * "Framing circle" is deliberately narrow — `rounded-full` PLUS content
 * centring. It does not catch pills (`.w-tag`, FilterPills, tabs), progress
 * fills, confetti, or skeleton placeholders; those are different clauses and
 * a broader regex would have made this list unmaintainable rather than true.
 */
const FRAMING_CIRCLE_FILES = [
  // The named exception itself, and the only sanctioned way to make a new one.
  "components/brand/icon-roundel.tsx",
  // Stamp family — stamps, seals, marks (DESIGN.md · Shapes, · Stamps & Grids).
  "components/brand/logo.tsx",
  "components/brand/member-mark.tsx",
  "components/brand/venue-mark.tsx",
  "components/customer/stamp-press-button.tsx",
  "components/loyalty/reward-seal.tsx",
  "components/loyalty/stamp-dot.tsx",
  "components/merchant/launch-readiness-panel.tsx",
  "components/merchant/reward-pool-form.tsx",
  "components/merchant/launch/billing-activation-asset-preview.tsx",
  // The brand signature disc in the customer-flow header and the PWA chrome
  // (DESIGN.md · Iconography: "The ✱ disc remains the brand signature").
  "components/customer/customer-flow-system.tsx",
  "components/pwa/app-pwa.tsx",
  // A loading shell mirroring the surface above it.
  "components/customer/loading-skeletons.tsx",
  // Named: "the customer tab-bar chips".
  "components/layout/customer-tab-bar.tsx",
  // NOT named by DESIGN.md — the merchant tab bar copies the customer chip and
  // the clause only grants the customer one. Listed so the sweep is honest
  // about what ships; written up for the owner in NEEDS-SIGNOFF.
  "components/layout/merchant-tab-bar.tsx",
  // Named: "the poster-chrome guidance chip".
  "components/merchant/qr-poster/poster-preview-chrome.tsx",
  // DESIGN.md · Iconography: "Status dots … stay as structural CSS."
  "components/auth/password-requirements.tsx",
]

test("every framing circle in the tree is on DESIGN.md's named exception list", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  // A filter that ate its whole input would pass on zero files.
  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  const framing = files.filter((file) => {
    const source = stripComments(read(file))
    for (const [attribute] of source.matchAll(
      /className=(?:"[^"]*"|\{[\s\S]{0,900}?\n\s*\)\}|\{[^}]*\})/g
    )) {
      if (!/\brounded-full\b/.test(attribute)) continue
      if (!/place-items-center/.test(attribute)) continue
      return true
    }
    return false
  })

  // The matcher must still find the real ones, or "no offenders" is vacuous.
  assert.ok(
    framing.length > 10,
    `expected the known framing circles, got ${framing.length}`
  )

  assert.deepEqual(
    framing.filter((file) => !FRAMING_CIRCLE_FILES.includes(file)).sort(),
    []
  )
})

test("DESIGN.md still carries the clause this list enforces", () => {
  const design = read("DESIGN.md")
  assert.match(design, /Full circles are reserved for the stamp family/)
  assert.match(
    design,
    /the list does not grow without updating this contract/
  )
  assert.match(
    design,
    /framing circles reach for `IconRoundel` rather than hand-rolling\s+`rounded-full`/
  )
})

/**
 * The other half: the halo. DESIGN.md names "the legal-link halo family" — the
 * /terms /privacy /cookies row in the marketing footer — and
 * marketing-chrome-tokens already rules that the footer's thirteen site links
 * "are navigation, not legal links, and were never on the list", and that the
 * footer's disclosure summary "is a heading row, not a stamp".
 *
 * The identical argument had never been applied outside that one file. The
 * auth funnel carried three pill halos (AuthPromptLink plus two verbatim copies
 * of its class string in reset-password-form), and the three legal routes
 * carried a pill on every in-document table-of-contents anchor and on the TOC
 * disclosure summary. All are navigation. They now use
 * `rounded-(--radius-md)`, the shape seven other min-h-11 inline text links in
 * the tree already use.
 */
test("no interactive text link outside the legal-link row wears a pill halo", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")]

  assert.ok(
    files.length > 500,
    `expected a real source tree, got ${files.length}`
  )

  const offenders = []

  for (const file of files) {
    // The named exception, pinned the other way round by
    // marketing-chrome-tokens (legalLinkClass MUST keep its halo).
    if (file === path.join("components", "layout", "marketing-layout.tsx")) {
      continue
    }
    const source = stripComments(read(file))
    for (const [attribute] of source.matchAll(
      /className=(?:"[^"]*"|\{[\s\S]{0,900}?\n\s*\)\}|\{[^}]*\})/g
    )) {
      if (!/\brounded-full\b/.test(attribute)) continue
      // The halo signature: a hit-area padded around inline text, keyed on the
      // shared focus recipe plus the underline offset (or, for a disclosure
      // summary, `list-none`) that these links all carry.
      if (!/focus-ring/.test(attribute)) continue
      if (!/underline-offset-4|list-none/.test(attribute)) continue
      // A halo is a bare hit area. The mono-pill register — FilterPills, admin
      // view-tabs, TabsTrigger — is a bordered chip and a different clause
      // ("The mono pill `.w-tag` is the only generic pill shape outside the
      // stamp family"); it reaches this regex only through a
      // `forced-colors:underline-offset-4` high-contrast fallback.
      if (/\bborder-2\b/.test(attribute)) continue
      offenders.push(`${file}: ${attribute.slice(0, 90)}`)
    }
  }

  assert.deepEqual(offenders, [])
})
