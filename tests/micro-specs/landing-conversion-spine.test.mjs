import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

// MS-landing-conversion-spine — `/` is a short conversion spine now the
// mechanism (/how-it-works), personas (/loyalty-for-*) and pricing (/pricing)
// live on their own routes. Copy is preserved at SITE level: every section
// removed from `/` renders on /how-it-works, which also gains the full proof
// tabs. Partially supersedes MS-landing-mobile-density's composition contract
// and MS-marketing-multipage HW-1.

test("CS-1 Given the spine When home composition is checked Then spine sections render and moved sections are absent", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")

  // When / Then — the spine…
  for (const tag of [
    "<LandingHero",
    "<CounterFlow",
    "<ProofStrip",
    "<NabaperksProofBody",
    "<VenuePersonas",
    "<TrustPricing",
    "<LandingFaq",
    "<FinalCta",
  ]) {
    assert.ok(homepage.includes(tag), `${tag} renders on /`)
  }
  // …and nothing that moved out stays mounted.
  for (const tag of [
    "<JumpNav",
    "<ComparisonTable",
    "<CounterVerifiedStamp",
    "<VenueBenefits",
    "<SeparateMarketing",
    "<LandingProof",
  ]) {
    assert.ok(!homepage.includes(tag), `${tag} no longer renders on /`)
  }
})

test("CS-2 Given sitewide copy preservation When /how-it-works is checked Then it mounts every moved section including the full proof tabs", () => {
  // Given
  const mechanism = readProjectFile("app", "how-it-works", "page.tsx")

  // When / Then
  for (const tag of [
    "<CounterFlow",
    "<ComparisonTable",
    "<CounterVerifiedStamp",
    "<LandingProof />",
    "<VenueBenefits",
    "<SeparateMarketing",
    "<LandingFaq />",
    "<FinalCta",
  ]) {
    assert.ok(mechanism.includes(tag), `${tag} renders on /how-it-works`)
  }
})

test("CS-3 Given the FAQ subset When render and schema are checked Then both use the same first-4 slice and the export keeps all 8", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")
  const mechanism = readProjectFile("app", "how-it-works", "page.tsx")
  const faqSource = readProjectFile(
    "components",
    "marketing",
    "landing",
    "faq.tsx"
  )

  // When / Then — visible copy === structured data, on the same slice.
  assert.match(homepage, /<LandingFaq limit=\{4\} \/>/)
  assert.match(homepage, /faqs\.slice\(0,\s*4\)/)
  // /how-it-works keeps the full set via the prop-less literal (HW-2).
  assert.ok(mechanism.includes("<LandingFaq />"))
  const faqCount = (faqSource.match(/\n\s*q:\s*"/g) ?? []).length
  assert.equal(faqCount, 8, "faqs export keeps all 8 questions")
})

test("CS-4 Given the home graph When schema sources are checked Then every required node type is still emitted", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")

  // When / Then — removing sections must not remove schema nodes.
  for (const node of [
    "SoftwareApplication",
    "FAQPage",
    "howToSchema",
    "counterLoyaltyIndexDataset",
    "glossarySchema",
    "breadcrumbSchema",
    "webPageSchema",
  ]) {
    assert.ok(homepage.includes(node), `home graph keeps ${node}`)
  }
})

test("CS-5 Given the multipage nav When the home header is checked Then it uses the shared default and drops the dangling anchor", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")

  // When / Then — no bespoke anchor navLinks, no reference to the moved
  // anti-fraud section's anchor.
  assert.ok(
    !homepage.includes("navLinks"),
    "home uses the shared default marketing header"
  )
  assert.ok(
    !homepage.includes("#anti-fraud"),
    "no dangling #anti-fraud reference on /"
  )
})

test("CS-6 Given the surviving anchors When section sources are checked Then #how-it-works, #for-venues and #pricing still exist", () => {
  // Given / When / Then — the spine's own sections keep their anchors.
  assert.ok(
    readProjectFile(
      "components",
      "marketing",
      "landing",
      "counter-flow.tsx"
    ).includes('id="how-it-works"')
  )
  assert.ok(
    readProjectFile(
      "components",
      "marketing",
      "landing",
      "venue-personas.tsx"
    ).includes('id="for-venues"')
  )
  assert.ok(
    readProjectFile(
      "components",
      "marketing",
      "landing",
      "trust-pricing.tsx"
    ).includes('id="pricing"')
  )
})
