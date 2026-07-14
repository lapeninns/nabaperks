import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

// Production-polish rows MKT-P0-01/02, MKT-P1-02/03, CUS-P1-03/04: public and
// customer legal surfaces must not self-label their wording as unreviewed, and
// /terms + /privacy must ship their own metadata with a canonical. Legal
// sign-off itself is an ops matter outside the repo; these assertions only
// keep internal review-voice presentation out of rendered source.

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

const REVIEW_VOICE_PATTERNS = [
  /review required/i,
  /not final legal wording/i,
  /human review/i,
  /pilot operation only/i,
  /review(ed)?\s+before\s+(public\s+)?launch/i,
]

const LEGAL_SURFACES = [
  ["lib", "legal", "content.ts"],
  ["components", "customer", "legal-sheet.tsx"],
  ["app", "terms", "page.tsx"],
  ["app", "privacy", "page.tsx"],
  ["app", "merchant", "[merchantSlug]", "terms", "page.tsx"],
]

test("Given customer and public legal surfaces When rendered source is inspected Then no internal review-voice wording remains", () => {
  for (const segments of LEGAL_SURFACES) {
    const source = readProjectFile(...segments)
    for (const pattern of REVIEW_VOICE_PATTERNS) {
      assert.doesNotMatch(
        source,
        pattern,
        `${segments.join("/")} must not contain review-voice wording (${pattern})`
      )
    }
  }
})

test("Given the consent-moment legal sheet When its props are inspected Then the review-notice render path is gone", () => {
  const legalSheet = readProjectFile(
    "components",
    "customer",
    "legal-sheet.tsx"
  )

  assert.doesNotMatch(legalSheet, /reviewNotice/)
  assert.doesNotMatch(legalSheet, /StatusBanner/)
})

test("Given /terms and /privacy sit in the sitemap When their pages are inspected Then each exports its own metadata with a canonical", () => {
  const terms = readProjectFile("app", "terms", "page.tsx")
  const privacy = readProjectFile("app", "privacy", "page.tsx")

  for (const [source, canonical] of [
    [terms, "/terms"],
    [privacy, "/privacy"],
  ]) {
    assert.match(source, /import type \{ Metadata \} from "next"/)
    assert.match(source, /export const metadata: Metadata = \{/)
    assert.match(
      source,
      new RegExp(`alternates: \\{ canonical: "${canonical}" \\}`)
    )
    assert.match(source, /description/)
  }
})
