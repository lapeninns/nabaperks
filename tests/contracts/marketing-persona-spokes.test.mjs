import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
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

// contract-marketing-persona-spokes — the three persona spokes the homepage already
// markets exist as standalone pages mirroring the pub hub, are registered in
// every route registry, and the VenuePersonas cards link to them (SE-5 stays
// green because routes and links land together).

const SPOKES = [
  { slug: "loyalty-for-cafes", routeKey: "cafeHub", personaId: "cafes" },
  {
    slug: "loyalty-for-takeaways",
    routeKey: "takeawayHub",
    personaId: "takeaways",
  },
  { slug: "loyalty-for-bars", routeKey: "barHub", personaId: "bars" },
]

function readSpoke(slug) {
  const file = path.join(projectRoot, "app", slug, "page.tsx")
  assert.ok(existsSync(file), `app/${slug}/page.tsx exists`)
  return readFileSync(file, "utf8")
}

test("PS-1 Given the three spokes When their composition is checked Then each mounts the shared sections with persona hero and asks", () => {
  for (const { slug, routeKey } of SPOKES) {
    // Given
    const page = readSpoke(slug)

    // When / Then
    assert.match(page, /<h1[\s>]/, `${slug} owns an h1`)
    for (const tag of [
      "<CounterFlow",
      "<NabaperksProof",
      "<FinalCta",
    ]) {
      assert.ok(page.includes(tag), `${tag} renders on /${slug}`)
    }
    assert.ok(
      !page.includes("<RegularsCalculator"),
      `${slug} does not mount RegularsCalculator (lives on the pub hub)`
    )
    assert.ok(
      page.includes("#regulars-calculator"),
      `${slug} links the pub-hub calculator from the wedge band`
    )
    // AV-3 (contract-marketing-audit-v2-fixes, partially superseding PS-1): the
    // comparison authority is /how-it-works — spokes mount the wedge band
    // that deep-links it, never the full table.
    assert.ok(
      !page.includes("<ComparisonTable"),
      `${slug} does not mount ComparisonTable (the wedge links the comparison)`
    )
    assert.ok(
      page.includes("#no-app"),
      `${slug} wedge deep-links /how-it-works#no-app`
    )
    assert.match(
      page,
      new RegExp(`canonical:\\s*("/${slug}"|ROUTES\\.${routeKey})`),
      `${slug} declares its canonical`
    )
    assert.ok(page.includes("ROUTES.signup"), `${slug} asks via /signup`)
    assert.ok(
      page.includes("CTA.startPilot"),
      `${slug} keeps the pilot ask via the single-source CTA constant`
    )
    assert.ok(page.includes("ROUTES.pricing"), `${slug} links pricing`)
    assert.ok(
      page.includes("ROUTES.howItWorks"),
      `${slug} cross-links the mechanism page instead of a guides rail`
    )
  }
})

test("PS-2 Given the honesty constraints When spoke copy is checked Then banned vocabulary and operator-vertical claims are absent and the claims guard scans the routes", () => {
  const claims = readProjectFile("scripts", "check-banned-claims.mjs")
  for (const { slug } of SPOKES) {
    // Given
    const page = readSpoke(slug)

    // When / Then — copy stays inside the approved vocabulary…
    assert.doesNotMatch(page, /chipp(y|ies)/i, `${slug} avoids "chippy"`)
    assert.doesNotMatch(page, /bubble\s*tea/i, `${slug} avoids "bubble tea"`)
    assert.doesNotMatch(
      page,
      /Lapen Inns|our pubs|we run/i,
      `${slug} claims no first-person operator experience for its vertical`
    )
    // …and the banned-claims guard scans the route so drift cannot land.
    assert.ok(
      claims.includes(`app/${slug}`),
      `banned-claims SCAN covers app/${slug}`
    )
  }
})

test("PS-3 Given the spoke page graphs When schema sources are checked Then each emits WebPage+Breadcrumb+HowTo without unpublished Dataset figures", () => {
  const jsonldGuard = readProjectFile("scripts", "check-jsonld.mjs")
  for (const { slug } of SPOKES) {
    // Given
    const page = readSpoke(slug)

    // When / Then
    assert.ok(page.includes("marketingPageGraph"), `${slug} builds the graph`)
    assert.ok(page.includes("howToSchema"), `${slug} emits a HowTo`)
    assert.ok(
      page.includes("counterFlowSteps"),
      `${slug} HowTo is byte-synced to the shared steps`
    )
    assert.ok(
      page.includes("#howto"),
      `${slug} HowTo @id is route-distinct (no home-graph collision)`
    )
    assert.doesNotMatch(
      page,
      /counterLoyaltyIndexDataset/,
      `${slug} does not publish the unverified aggregate dataset`
    )
    assert.ok(
      jsonldGuard.includes(slug),
      `jsonld guard validates /${slug}`
    )
  }
})

test("PS-4 Given the route registries When they are checked Then facts, sitemap rows, llms.txt, CSP, e2e rosters and the footer include all three spokes", () => {
  // Given
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const llms = readProjectFile("public", "llms.txt")
  const csp = readProjectFile("lib", "security", "csp.ts")
  const layout = readProjectFile("components", "layout", "marketing-layout.tsx")

  // When / Then
  for (const { slug, routeKey } of SPOKES) {
    assert.match(
      facts,
      new RegExp(`${routeKey}:\\s*"/${slug}"`),
      `ROUTES.${routeKey} points at /${slug}`
    )
    assert.match(
      facts,
      new RegExp(`ROUTES\\.${routeKey},\\s*priority`),
      `PUBLIC_SITE_ROUTES lists ${routeKey} (sitemap coverage)`
    )
    assert.ok(
      llms.includes(`https://nabaperks.com/${slug}`),
      `llms.txt lists /${slug} verbatim`
    )
    assert.ok(
      csp.includes(`"/${slug}"`),
      `static-marketing CSP path list includes /${slug}`
    )
    assert.ok(layout.includes(`/${slug}`), `marketing footer links /${slug}`)
    for (const roster of [
      ["tests", "e2e", "visual.spec.ts"],
      ["tests", "e2e", "helpers", "a11y-sweep.ts"],
      ["tests", "e2e", "public-route-metadata.spec.ts"],
    ]) {
      assert.ok(
        readProjectFile(...roster).includes(`/${slug}`),
        `${roster.join("/")} covers /${slug}`
      )
    }
  }
})

test("PS-5 Given the landing persona cards When persona-data is checked Then cafes, takeaways and bars are live and route through ROUTES", () => {
  // Given
  const personaData = readProjectFile(
    "components",
    "marketing",
    "landing",
    "persona-data.ts"
  )

  // When / Then — each persona entry references the registry route and is
  // flagged live so VenuePersonas renders a real link (SE-5: routes and links
  // land in the same change).
  for (const { routeKey, personaId } of SPOKES) {
    assert.ok(
      personaData.includes(`ROUTES.${routeKey}`),
      `${personaId} spoke href routes through ROUTES.${routeKey}`
    )
    const entry = personaData.slice(personaData.indexOf(`id: "${personaId}"`))
    const nextEntry = entry.indexOf("id:", 4)
    const block = nextEntry === -1 ? entry : entry.slice(0, nextEntry)
    assert.ok(
      /live:\s*true/.test(block),
      `${personaId} persona card is live`
    )
  }
})

test("PS-7 Given the frozen single-sources When their exports are counted Then counterFlowSteps keeps 4 steps and faqs keeps all 8 questions", () => {
  // Given
  const flowSource = readProjectFile(
    "components",
    "marketing",
    "landing",
    "counter-flow.tsx"
  )
  const faqSource = readProjectFile(
    "components",
    "marketing",
    "landing",
    "faq.tsx"
  )

  // When / Then
  const stepCount = (flowSource.match(/\n\s*step:\s*"/g) ?? []).length
  assert.equal(stepCount, 4, "counterFlowSteps keeps its four beats")
  const faqCount = (faqSource.match(/\n\s*q:\s*"/g) ?? []).length
  assert.equal(faqCount, 8, "faqs export keeps all 8 questions")
})
