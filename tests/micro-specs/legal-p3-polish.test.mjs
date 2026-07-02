import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

// Production-polish rows MKT-P3-14/15 and VCU-P3-14: on mobile the /terms and
// /privacy TOC card must sit below the content (title above the fold), the
// operator-voice /privacy page must carry a short customer-facing paragraph
// for customers arriving from footer/marketing links, and the venue-terms
// unavailable state must recover via the shared journey actions instead of a
// possibly-dead "Back to loyalty card" loop.

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given the /terms and /privacy TOC cards When viewed below lg Then they order after the article so the h1 stays above the fold", () => {
  const terms = readProjectFile("app", "terms", "page.tsx")
  const privacy = readProjectFile("app", "privacy", "page.tsx")

  for (const source of [terms, privacy]) {
    assert.match(source, /<aside className="[^"]*\border-last\b[^"]*\blg:order-none\b/)
  }
})

test("Given customers reach /privacy from footer and marketing links When the operator-voice page renders Then a customer-facing paragraph orients them", () => {
  const privacy = readProjectFile("app", "privacy", "page.tsx")

  assert.match(privacy, /If you&apos;re a customer/)
})

test("Given an invalid venue slug on the terms route When the unavailable state renders Then recovery uses the shared journey actions not a dead venue link", () => {
  const merchantTerms = readProjectFile(
    "app",
    "merchant",
    "[merchantSlug]",
    "terms",
    "page.tsx"
  )

  assert.match(
    merchantTerms,
    /import \{ UnavailableRecoveryActions \} from "@\/components\/customer\/unavailable-recovery"/
  )
  assert.match(merchantTerms, /<UnavailableRecoveryActions \/>/)
  assert.doesNotMatch(merchantTerms, /Back to loyalty card/)
})
