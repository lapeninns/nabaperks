import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Marketing rebuild contracts (offer v3, sourced from the finalised offer
 * pack): the locked commercial model lives in `lib/marketing/facts.ts`, every
 * marketing surface renders prices through those facts, there is no setup fee
 * (removed 2026-07-19), and the public route registry cannot drift from
 * llms.txt.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function walk(dir) {
  const abs = path.join(projectRoot, dir)
  const out = []
  for (const name of readdirSync(abs)) {
    const rel = path.join(dir, name)
    const stats = statSync(path.join(projectRoot, rel))
    if (stats.isDirectory()) {
      out.push(...walk(rel))
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(rel)
    }
  }
  return out
}

const MARKETING_PAGE_ROOTS = [
  "app/page.tsx",
  "app/how-it-works",
  "app/pricing",
  "app/demo",
  "app/about",
  "app/loyalty-for-pubs",
  "app/loyalty-for-cafes",
  "app/loyalty-for-bars",
  "app/loyalty-for-takeaways",
  "app/guides",
  "components/marketing",
]

function marketingSourceFiles() {
  return MARKETING_PAGE_ROOTS.flatMap((root) => {
    const abs = path.join(projectRoot, root)
    return statSync(abs).isDirectory() ? walk(root) : [root]
  })
}

test("Given the finalised offer pack When facts.ts is inspected Then the locked commercial model is encoded", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  // The safer wrapper leads public pages; the campaign wrapper is retained
  // only for a separately approved campaign.
  assert.match(facts, /name: "The 30-Day First-Regular Launch"/)
  assert.match(
    facts,
    /campaignName: "The 30-Day Gastropub Mid-Week Revenue Accelerator"/
  )
  assert.match(facts, /nameSafe: "The 30-Day First-Regular Launch"/)
  // The name is contextualised with a plain benefit line, and must never
  // render the revenue-promise disclaimer voice or the word "guarantee".
  assert.match(
    facts,
    /nameNote:\s*\n?\s*"Built to encourage measurable return visits/
  )
  assert.doesNotMatch(facts, /nameNote:[^\n]*guarantee/i)

  // No setup fee (owner decision 2026-07-19 — removed entirely). The offer is
  // a pure subscription: PLAN_LINE is the single-sourced investment line, and
  // the SETUP_FEE constant and its price line no longer exist.
  assert.doesNotMatch(
    facts,
    /export const SETUP_FEE\b/,
    "the SETUP_FEE constant must be gone — there is no setup fee"
  )
  assert.match(facts, /export const PLAN_LINE = /)
  assert.match(facts, /There is NO setup fee/i)

  // Subscription facts stay the surviving £49/£490 model.
  assert.match(facts, /price: "£49\/month"/)
  assert.match(facts, /priceAnnual: "£490\/year"/)
  assert.match(facts, /pilot: "30-day free pilot"/)

  // Guarantee stack: First-Regular plus the 90-Day ROI Extension.
  assert.match(facts, /export const GUARANTEE = \{/)
  assert.match(facts, /export const GUARANTEE_ROI = \{/)
  assert.match(facts, /name: "90-Day ROI Extension"/)
  assert.match(
    facts,
    /your next 3 months are completely free/,
    "ROI extension headline must match the guarantee doc"
  )
  assert.match(facts, /We do not guarantee midweek revenue or filled tables\./)

  // Honest scarcity: the real 5-a-week human cap.
  assert.match(facts, /export const SCARCITY = \{/)
  assert.match(facts, /5 new pubs a week/)

  // Delivery: the five done-for-you steps and the three bonuses.
  const dfySteps = facts.match(
    /title: "(We set up|We configure|We turn on|We print|You go live)/g
  )
  assert.equal(
    dfySteps?.length,
    5,
    "DFY_LAUNCH must carry the five master-doc steps"
  )
  assert.match(facts, /export const CORE_OFFER = \[/)
  assert.match(facts, /export const BONUS_STACK = \[/)
  assert.match(facts, /Bring a Regular/)

  // Hybrid SaaS-blueprint sections are sourced from the pack: the pain
  // objections (doc 3 Step 2), the feature set, and the before/after outcome.
  assert.match(facts, /export const PROBLEM = \{/)
  assert.match(facts, /export const FEATURES: readonly MarketingFeature\[\]/)
  assert.match(facts, /export const TRANSFORMATION = \{/)
  const featureTabs = facts.match(
    /key: "(no-app-qr|mystery-rewards|dashboard|birthdays|referrals|posters)"/g
  )
  assert.equal(
    featureTabs?.length,
    6,
    "FEATURES must carry the six product-feature tabs"
  )
})

test("Given the hybrid SaaS blueprint When the landing composes sections Then they render in the conversion order", () => {
  const landing = readProjectFile("app", "page.tsx")

  // The absorbed components are gone from the landing (their content migrated
  // into Problem/Features/Outcome/Pricing).
  for (const gone of ["OfferStack", "ValueEquation", "BonusStack"]) {
    assert.doesNotMatch(
      landing,
      new RegExp(`<${gone}\\b`),
      `${gone} was absorbed and must not render on the landing`
    )
  }

  // The intent-led order: orient -> evidence -> problem -> process -> complete
  // offer -> qualification -> outcome -> guarantees -> pricing -> capacity ->
  // research guides -> FAQ -> final CTA.
  const order = [
    "LandingHero",
    "LandingNav",
    "ProofStrip",
    "ProblemPains",
    "LaunchProcess",
    "FeaturesListicle",
    "VenueFit",
    "OutcomeTransformation",
    "GuaranteeStack",
    "LandingPricing",
    "ScarcityBand",
    "LandingGuides",
    "LandingFaq",
    "FinalCta",
  ]
  let cursor = -1
  for (const section of order) {
    const at = landing.indexOf(`<${section}`)
    assert.ok(at > -1, `landing must render <${section}`)
    assert.ok(
      at > cursor,
      `${section} must appear after the previous blueprint section`
    )
    cursor = at
  }
})

test("Given marketing surfaces When scanned for prices Then every £-figure renders via facts, never a literal", () => {
  for (const file of marketingSourceFiles()) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.doesNotMatch(
      source,
      /£\d/,
      `${file} must render prices via lib/marketing/facts.ts, not a literal £-amount`
    )
  }
})

test("Given the setup fee was removed When all source is scanned Then no setup-fee constant, £99, or £0-setup copy survives", () => {
  const allSource = [...walk("app"), ...walk("components"), ...walk("lib")]

  for (const file of allSource) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")

    assert.ok(
      !source.includes("SETUP_FEE"),
      `${file} must not reference SETUP_FEE — the setup fee was removed entirely`
    )
    assert.ok(
      !/£99|£0 setup/i.test(source),
      `${file} must not mention the old £99 / £0-setup fee`
    )
  }

  // No stray SetupPriceLine component or import survives.
  assert.ok(
    !existsSync(
      path.join(projectRoot, "components/marketing/setup-price-line.tsx")
    ),
    "setup-price-line.tsx must be deleted"
  )

  // The surviving £49/£490 checkout binds to PRODUCT facts only.
  const checkoutForm = readProjectFile(
    "components",
    "merchant",
    "account",
    "billing-checkout-form.tsx"
  )
  assert.match(checkoutForm, /PRODUCT\.price/)
  assert.match(checkoutForm, /PRODUCT\.priceAnnual/)
})

test("Given the public route registry When llms.txt is compared Then no rebuilt route is missing", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const llms = readProjectFile("public", "llms.txt")
  const routesBlock = facts.match(
    /export const PUBLIC_SITE_ROUTES = \[[\s\S]*?\] as const/
  )?.[0]

  assert.ok(routesBlock, "PUBLIC_SITE_ROUTES registry missing")

  const expectedPaths = [
    "/",
    "/pricing",
    "/how-it-works",
    "/loyalty-for-pubs",
    "/guides/reward-regulars-without-an-app",
    "/guides/best-loyalty-ideas-for-pubs",
    "/guides/paper-vs-qr-loyalty-for-pubs",
    "/about",
  ]

  for (const routePath of expectedPaths) {
    assert.ok(
      llms.includes(`https://nabaperks.com${routePath}`),
      `llms.txt must list ${routePath}`
    )
  }

  // Each route key referenced by the registry resolves to a real page file.
  const pageFiles = [
    ["app", "page.tsx"],
    ["app", "pricing", "page.tsx"],
    ["app", "how-it-works", "page.tsx"],
    ["app", "loyalty-for-pubs", "page.tsx"],
    ["app", "guides", "reward-regulars-without-an-app", "page.tsx"],
    ["app", "guides", "best-loyalty-ideas-for-pubs", "page.tsx"],
    ["app", "guides", "paper-vs-qr-loyalty-for-pubs", "page.tsx"],
    ["app", "about", "page.tsx"],
  ]
  for (const segments of pageFiles) {
    assert.ok(
      statSync(path.join(projectRoot, ...segments)).isFile(),
      `${segments.join("/")} must exist`
    )
  }
})

test("Given the claims boundary When key surfaces are inspected Then the guarantee stack and boundary render from shared facts", () => {
  const landing = readProjectFile("app", "page.tsx")
  const pricing = readProjectFile("app", "pricing", "page.tsx")
  const guaranteeStack = readProjectFile(
    "components",
    "marketing",
    "landing",
    "guarantee-stack.tsx"
  )
  const personaPage = readProjectFile(
    "components",
    "marketing",
    "persona-page.tsx"
  )

  assert.match(landing, /GuaranteeStack/)
  assert.match(pricing, /GuaranteeStack/)
  assert.match(guaranteeStack, /CLAIMS_BOUNDARY/)
  assert.match(guaranteeStack, /GUARANTEE_ROI/)
  assert.match(personaPage, /CLAIMS_BOUNDARY/)
})

test("Given honest scarcity When marketing surfaces are scanned Then no availability counter or countdown ships", () => {
  for (const file of marketingSourceFiles()) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    assert.doesNotMatch(
      source,
      /spots? left|countdown|timer/i,
      `${file} must not ship availability counters or countdown urgency`
    )
  }
})

test("Given the pub-first SEO strategy When persona surfaces are inspected Then only the pub spoke is indexable and no public spoke leads with revenue wording", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const personasBlock = facts.match(
    /export const PERSONAS[\s\S]*?\] as const/
  )?.[0]

  assert.ok(personasBlock, "PERSONAS registry missing")
  assert.doesNotMatch(personasBlock, /Revenue Accelerator/)
  assert.equal(
    personasBlock.match(/primary: true/g)?.length,
    1,
    "exactly one persona is primary"
  )
  assert.match(
    personasBlock,
    /designed for food-led pubs first/,
    "non-pub spokes must carry the pub-first fit note"
  )

  const personaPage = readProjectFile(
    "components",
    "marketing",
    "persona-page.tsx"
  )
  assert.match(personaPage, /robots: persona\.primary/)
  assert.match(personaPage, /index: false/)

  const llms = readProjectFile("public", "llms.txt")
  for (const path of [
    "/loyalty-for-cafes",
    "/loyalty-for-bars",
    "/loyalty-for-takeaways",
  ]) {
    assert.ok(
      !llms.includes(`https://nabaperks.com${path}`),
      `${path} is demoted`
    )
  }
})

test("Given the owner removed the setup fee When the finalised pack is scanned Then no stale £99 commercial term remains", () => {
  const offerDir = path.join(projectRoot, "Offers- Nabaperks-Finalized")
  for (const file of readdirSync(offerDir)) {
    if (!file.endsWith(".md")) continue
    const source = readFileSync(path.join(offerDir, file), "utf8")
    assert.doesNotMatch(source, /£99/, `${file} contains the retired setup fee`)
  }
})

test("Given the demo is an app-like surface When its metadata is inspected Then it stays unindexed", () => {
  const demoPage = readProjectFile("app", "demo", "page.tsx")
  const seoMetadata = readProjectFile("lib", "seo", "metadata.ts")

  assert.match(demoPage, /PRIVATE_ROUTE_METADATA/)
  assert.match(seoMetadata, /"\/demo"/)
})

test("Given the conversion landing When facts.ts is inspected Then the structural copy is single-sourced and claim-safe", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  assert.match(facts, /export const LANDING = \{/)
  assert.match(
    facts,
    /headline:\s*\n?\s*"Give your weekend crowd a reason to come back on a Tuesday"/,
    "the hero headline must use the safe 'a reason to come back' framing"
  )

  const landingBlock = facts.match(
    /export const LANDING = \{[\s\S]*?\n\} as const/
  )?.[0]
  assert.ok(landingBlock, "LANDING block missing")

  // The landing must never promise an outcome, only a reason to come back.
  assert.doesNotMatch(
    landingBlock,
    /will come back|guarantee|filled tables|more revenue/i,
    "landing copy must not promise a revenue or return-visit outcome"
  )
  // Three product-moment beats, one fit statement.
  assert.equal(
    landingBlock.match(/caption: "/g)?.length,
    3,
    "the product moment carries exactly three beats"
  )
})
