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

// contract-marketing-audit-v2-fixes — the v2 audit's P1/P2 fixes: route-distinct
// hub HowTo id, /signup metadata, spoke wedge redesign, plan-includes single
// source, llms.txt claim parity, operator disclosure, and guard extensions.

const SPOKES = ["loyalty-for-cafes", "loyalty-for-takeaways", "loyalty-for-bars"]

const WEDGE_CLAUSES = {
  "loyalty-for-cafes": "no staff entry at the coffee counter",
  "loyalty-for-takeaways": "no staff entry at the collection counter",
  "loyalty-for-bars": "no staff entry at the bar",
}

test("AV-1 Given the pub hub graph When the HowTo id is checked Then it is route-distinct and the jsonld guard pins it", () => {
  // Given
  const pubHub = readProjectFile("app", "loyalty-for-pubs", "page.tsx")
  const guard = readProjectFile("scripts", "check-jsonld.mjs")

  // When / Then — the shared default #how-it-works id is reserved for `/`.
  assert.match(
    pubHub,
    /howToSchema\(pubCounterFlowSteps,\s*\{\s*id:/,
    "pub hub passes an explicit HowTo id"
  )
  assert.ok(
    pubHub.includes("#howto"),
    "pub hub HowTo id uses the route-distinct #howto convention"
  )
  assert.ok(
    guard.includes("loyalty-for-pubs#howto"),
    "jsonld guard asserts the hub HowTo @id (the audit's guard gap)"
  )
})

test("AV-2 Given /signup is an indexable acquisition route When its head is sourced Then it exports full metadata with the single-source cancellation term", () => {
  // Given
  const signup = readProjectFile("app", "(auth)", "signup", "page.tsx")

  // When / Then
  assert.match(signup, /export const metadata: Metadata/)
  assert.match(
    signup,
    /canonical: ROUTES\.signup/,
    "self-canonical so ?email= variants collapse"
  )
  assert.match(
    signup,
    /\$\{PRODUCT\.cancelLine\}/,
    "description interpolates the cancellation constant (never the literal)"
  )
  assert.match(signup, /openGraph:/)
  assert.match(signup, /twitter:/)
  assert.match(signup, /summary_large_image/)
})

test("AV-3 Given the three spokes When the wedge band is checked Then the hedged claim and a distinct venue-true clause render and the table stays on hub + mechanism pages", () => {
  for (const slug of SPOKES) {
    // Given
    const page = readProjectFile("app", slug, "page.tsx")

    // When / Then — hedge stays approved ("Most …"), clause stays venue-true.
    assert.ok(
      page.includes("Most &ldquo;no-app&rdquo;"),
      `${slug} wedge carries the hedged wallet-pass claim`
    )
    assert.match(
      page,
      new RegExp(WEDGE_CLAUSES[slug].replaceAll(" ", "\\s+")),
      `${slug} wedge carries its venue-true clause`
    )
  }
  const clauses = Object.values(WEDGE_CLAUSES)
  assert.equal(
    new Set(clauses).size,
    clauses.length,
    "wedge clauses stay distinct across the three spokes"
  )
  for (const keeper of [
    ["app", "how-it-works", "page.tsx"],
    ["app", "loyalty-for-pubs", "page.tsx"],
  ]) {
    assert.ok(
      readProjectFile(...keeper).includes("<ComparisonTable"),
      `${keeper.join("/")} keeps ComparisonTable`
    )
  }
})

test("AV-4 Given the plan-includes list When its sources are checked Then facts.ts owns it once and both pricing surfaces consume it", () => {
  // Given
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const trustPricing = readProjectFile(
    "components",
    "marketing",
    "landing",
    "trust-pricing.tsx"
  )
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  // When / Then
  assert.match(facts, /export const PLAN_INCLUDES = \[/)
  assert.ok(
    facts.includes("Weekly digest of visits, regulars and redemptions"),
    "digest wording lives in facts (no Oxford comma, site-wide form)"
  )
  const factsEntries = (facts.match(/\n\s{2}"[^"]+",\s*\n/g) ?? []).length
  assert.ok(
    trustPricing.includes("PLAN_INCLUDES") &&
      /PLAN_INCLUDES\.slice\(0,\s*4\)/.test(trustPricing),
    "TrustPricing teases the first four items of the single source"
  )
  assert.ok(
    pricing.includes("PLAN_INCLUDES"),
    "/pricing renders the single-source list"
  )
  for (const consumer of [trustPricing, pricing]) {
    assert.ok(
      !consumer.includes('"Weekly digest'),
      "the digest item is not re-declared outside facts.ts"
    )
  }
  void factsEntries
})

test("AV-5 Given the description budget When the trimmed/enriched routes are sourced Then the new hooks are present", () => {
  const about = readProjectFile("app", "about", "page.tsx")
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  assert.ok(
    about.includes("from people who run the counter"),
    "about description trimmed inside budget with the lede intact"
  )
  assert.ok(
    pricing.includes("unlimited stamps and members included"),
    "pricing description carries the included-features hook"
  )
})

test("AV-6 Given llms.txt is the AI-quotable surface When the wallet-pass claim is checked Then it carries the same hedge as visible copy", () => {
  const llms = readProjectFile("public", "llms.txt")

  assert.match(llms, /Most rivals that say "no app"/)
  assert.doesNotMatch(llms, /\. Rivals that say "no app"/)
})

test("AV-7 Given the venue quotes render on two surfaces When VenueProof is sourced Then it discloses the operator relationship", () => {
  const venueProof = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-proof.tsx"
  )

  assert.match(venueProof, /OPERATOR\.name/)
  assert.ok(
    venueProof.includes("the operator behind Nabaperks"),
    "quotes disclose they come from the operator's own estate"
  )
})

test("AV-8 Given /about is the operator page When its graph is sourced Then it attributes review/authorship to the operator", () => {
  const about = readProjectFile("app", "about", "page.tsx")

  assert.match(about, /reviewedByOperator: true/)
})

test("AV-13 Given /how-it-works is the mechanism authority When its graph is sourced Then it attributes review to the operator", () => {
  const howItWorks = readProjectFile("app", "how-it-works", "page.tsx")

  assert.match(howItWorks, /reviewedByOperator: true/)
})

test("AV-14 Given persona cards are all live When venue-personas is sourced Then the vestigial SHOW_PERSONA_SPOKES flag is gone", () => {
  const personaData = readProjectFile(
    "components",
    "marketing",
    "landing",
    "persona-data.ts"
  )
  const venuePersonas = readProjectFile(
    "components",
    "marketing",
    "landing",
    "venue-personas.tsx"
  )

  assert.doesNotMatch(personaData, /SHOW_PERSONA_SPOKES/)
  assert.doesNotMatch(venuePersonas, /SHOW_PERSONA_SPOKES/)
})

test("AV-9 Given the guides carry real dates When the jsonld guard is checked Then all three guides are validated with their dates", () => {
  const guard = readProjectFile("scripts", "check-jsonld.mjs")

  for (const slug of [
    "best-loyalty-ideas-for-pubs",
    "reward-regulars-without-an-app",
    "paper-vs-qr-loyalty-for-pubs",
  ]) {
    assert.ok(guard.includes(slug), `jsonld guard loads guides/${slug}`)
  }
  assert.match(
    guard,
    /datePublished/,
    "guard asserts Article dates (the audit's guides-guard gap)"
  )
})

test("AV-10 Given the spoke benefit lists When stamp controls are checked Then every venue uses accurate venue-linked wording", () => {
  const cafe = readProjectFile("app", "loyalty-for-cafes", "page.tsx")
  const takeaway = readProjectFile("app", "loyalty-for-takeaways", "page.tsx")
  const pub = readProjectFile("app", "loyalty-for-pubs", "page.tsx")

  for (const [name, source] of [
    ["cafe", cafe],
    ["takeaway", takeaway],
    ["pub", pub],
  ]) {
    assert.doesNotMatch(source, /faked or double-claimed|counter-verified/)
    assert.match(source, /venue-linked/, `${name} uses the shared truthful term`)
    assert.match(
      source,
      /one stamp per customer per UK date|one-per-UK-date/,
      `${name} names the enforced daily cap`
    )
  }
})

test("AV-11 Given /pricing is 500 words When its FAQ answers are checked Then the location-check reassurance appears at most once", () => {
  const pricing = readProjectFile("app", "pricing", "page.tsx")

  const occurrences = (pricing.match(/location checks can flag/g) ?? []).length
  assert.equal(occurrences, 1, "one location-check reassurance on the page")
})

test("AV-12 Given house style uses HTML entities When the stamp component is checked Then no literal typographic quotes remain", () => {
  const stamp = readProjectFile(
    "components",
    "marketing",
    "landing",
    "counter-verified-stamp.tsx"
  )

  assert.doesNotMatch(stamp, /[“”’]/)
})
