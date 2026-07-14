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

// contract-marketing-multipage — /how-it-works is the standalone mechanism page
// mounting the same single-source sections as the rest of the marketing site.
// HW-1's original home-freeze is superseded by contract-landing-conversion-spine:
// the homepage is now the conversion spine (its contract lives in
// landing-conversion-spine.test.mjs); this check pins the spine composition.

test("HW-1 Given the conversion spine When the homepage is checked Then it keeps the spine composition (per contract-landing-conversion-spine)", () => {
  // Given
  const homepage = readProjectFile("app", "page.tsx")

  // When / Then — the spine composition is intact (belt to the
  // landing-conversion-spine contract's braces)…
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
    assert.ok(homepage.includes(tag), `${tag} still renders on /`)
  }
  // …with its full page graph (mechanism + objection schema stay on home).
  for (const node of ["howToSchema", "FAQPage"]) {
    assert.ok(homepage.includes(node), `home graph keeps ${node}`)
  }
})

test("HW-2/HW-7 Given /how-it-works When its composition is checked Then the standalone mechanism page mounts the shared sections with asks", () => {
  // Given
  const page = readProjectFile("app", "how-it-works", "page.tsx")

  // When / Then
  assert.match(page, /<h1[\s>]/, "the mechanism page owns an h1")
  for (const tag of [
    "<CounterFlow",
    "<ComparisonTable",
    "<CounterVerifiedStamp",
    "<VenueBenefits",
    "<SeparateMarketing",
    "<LandingFaq />",
    "<FinalCta",
  ]) {
    assert.ok(page.includes(tag), `${tag} renders on /how-it-works`)
  }
  assert.match(page, /canonical:\s*("\/how-it-works"|ROUTES\.howItWorks)/)
  assert.ok(page.includes('"/signup"'), "header ask resolves to /signup")
  assert.ok(page.includes("Start free pilot"))
})

test("HW-3/HW-5 Given the page graphs When schema sources are checked Then /how-it-works owns route-distinct HowTo+FAQPage and the single-sources stay frozen", () => {
  // Given
  const mechanism = readProjectFile("app", "how-it-works", "page.tsx")
  const faqSource = readProjectFile(
    "components",
    "marketing",
    "landing",
    "faq.tsx"
  )

  // When / Then — the standalone page emits both nodes from the frozen
  // exports, with @ids that cannot collide with home's graph.
  assert.ok(mechanism.includes("howToSchema"))
  assert.ok(mechanism.includes("counterFlowSteps"))
  assert.ok(mechanism.includes("FAQPage"))
  assert.ok(mechanism.includes("#howto"), "HowTo @id is route-distinct")
  const faqCount = (faqSource.match(/\n\s*q:\s*"/g) ?? []).length
  assert.equal(faqCount, 8, "faqs export keeps all 8 questions")
})

test("HW-4 Given the new route When registries are checked Then nav, sitemap, llms.txt, CSP and guard route lists all include /how-it-works", () => {
  // Given / When / Then
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  assert.match(facts, /howItWorks:\s*"\/how-it-works"/)
  assert.match(facts, /ROUTES\.howItWorks,\s*priority/)

  const layout = readProjectFile(
    "components",
    "layout",
    "marketing-layout.tsx"
  )
  const layoutLinkCount = (layout.match(/\/how-it-works/g) ?? []).length
  assert.ok(
    layoutLinkCount >= 2,
    "default header nav and footer both link /how-it-works"
  )

  assert.ok(
    readProjectFile("public", "llms.txt").includes("/how-it-works"),
    "llms.txt lists the mechanism page"
  )
  assert.ok(
    readProjectFile("lib", "security", "csp.ts").includes('"/how-it-works"'),
    "static-marketing CSP path list includes /how-it-works"
  )
  assert.ok(
    readProjectFile("scripts", "check-jsonld.mjs").includes("how-it-works"),
    "jsonld guard validates the mechanism page"
  )
  assert.ok(
    readProjectFile("scripts", "check-banned-claims.mjs").includes(
      "app/how-it-works"
    ),
    "banned-claims BANNED tier scans the new route"
  )
  for (const [file, hint] of [
    [["tests", "e2e", "visual.spec.ts"], "/how-it-works"],
    [["tests", "e2e", "helpers", "a11y-sweep.ts"], "/how-it-works"],
    [["tests", "e2e", "public-route-metadata.spec.ts"], "/how-it-works"],
  ]) {
    assert.ok(
      readProjectFile(...file).includes(hint),
      `${file.join("/")} covers /how-it-works`
    )
  }
})
