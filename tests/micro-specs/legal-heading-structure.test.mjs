import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

// Production-polish rows MKT-P2-07/08, VCU-P2-07: the /terms and /privacy
// section titles must be real <h2> headings (screen readers can navigate the
// sections the TOC advertises) while the TOC anchor wiring stays intact, and
// the venue-terms unavailable state must carry the brand roundel like its
// sibling error pages.

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given /terms and /privacy advertise a TOC When section blocks render Then titles are h2 headings and anchors survive", () => {
  const terms = readProjectFile("app", "terms", "page.tsx")
  const privacy = readProjectFile("app", "privacy", "page.tsx")

  for (const source of [terms, privacy]) {
    // Section titles are headings, not mono <p> eyebrows. The mono styling
    // now comes from the sanctioned .mono-meta utility (DESIGN.md micro-type
    // scale) rather than a hand-rolled font-mono string.
    assert.match(source, /<h2\s+className="mono-meta/)
    assert.doesNotMatch(source, /<p className="(?:font-mono|mono-)/)
    // TOC wiring: nav links to #section-id, section carries the id + focus target.
    assert.match(source, /href=\{`#\$\{section\.id\}`\}/)
    assert.match(source, /<section\s+id=\{id\}\s+tabIndex=\{-1\}/)
    // Exactly one h1 source (PageTitle) — blocks must not mint h1s.
    assert.doesNotMatch(source, /<h1/)
  }
})

test("Given the venue-terms unavailable state When it renders Then the brand roundel confirms where the customer is", () => {
  const merchantTerms = readProjectFile(
    "app",
    "merchant",
    "[merchantSlug]",
    "terms",
    "page.tsx"
  )

  assert.match(merchantTerms, /\bLogo\b.*from "@\/components\/brand"|import \{[^}]*\bLogo\b[^}]*\} from "@\/components\/brand"/)
  assert.match(merchantTerms, /<Logo compact/)
})

test("Given the sheet-title slot rule carries weight-800 When the legal sheet title renders Then no redundant font-extrabold hand-patch remains", () => {
  const legalSheet = readProjectFile(
    "components",
    "customer",
    "legal-sheet.tsx"
  )

  assert.doesNotMatch(legalSheet, /SheetTitle className="[^"]*font-extrabold/)
})
